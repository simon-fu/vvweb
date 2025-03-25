
import { Device } from 'mediasoup-client';
import { Transport } from 'mediasoup-client/lib/Transport';
import { AppData, Producer } from 'mediasoup-client/lib/types';
import { Client, User, Notice, Stream} from "./client";
import { EventEmitter, Listener } from "./emitter";
import { ROUTER_RTP_CAPABILITIES } from './rtp_capabilities';

export interface VVRTCOptions {
    url?: string,
}

export interface JoinRoomConfig {
	userId: string;
	roomId: string;
}

export const VVRTCEvent = {
    USER_JOIN: 'user-join',
    USER_LEAVE: 'user-leave',
    USER_CAMERA_ON: 'user-video-on',
} as const; 


export declare interface VVRTCEventTypes {
	[VVRTCEvent.USER_JOIN]: [{
		userId: string;
	}];
	[VVRTCEvent.USER_LEAVE]: [{
		userId: string;
	}];
    [VVRTCEvent.USER_CAMERA_ON]: [{
		userId: string;
	}];
}

export declare interface CameraConfig {
	view?: HTMLVideoElement;
	publish?: boolean;
	// mute?: boolean | string;
	// option?: {
	// 	cameraId?: string;
	// 	useFrontCamera?: boolean;
	// 	profile?: keyof typeof videoProfileMap | VideoProfile;
	// 	fillMode?: 'contain' | 'cover' | 'fill';
	// 	mirror?: boolean | string;
	// 	small?: keyof typeof videoProfileMap | VideoProfile | boolean;
	// 	qosPreference?: typeof TRTCType.QOS_PREFERENCE_SMOOTH | typeof TRTCType.QOS_PREFERENCE_CLEAR;
	// 	videoTrack?: MediaStreamTrack;
	// };
}

export declare interface UserVideoConfig {
    userId: string;
	view?: HTMLVideoElement; // TODO: 增加更多类型
	
	// streamType: TRTCStreamType;
	// option?: {
	// 	fillMode?: 'contain' | 'cover' | 'fill';
	// 	mirror?: boolean;
	// 	small?: boolean;
	// 	receiveWhenViewVisible?: boolean;
	// 	viewRoot?: HTMLElement;
	// 	canvasRender?: boolean;
	// };
}

interface UserCell {
    user: User,
    video?: UserVideo,
}

interface UserVideo {
    view?: HTMLVideoElement,
    track?: ConsumeTrack,
}

interface ConsumeTrack {
    streamId: string,
    producerId: string,
    consumerId?: string,
    media?: MediaStreamTrack,
}


interface LocalCamera {
    config?: CameraConfig,
    stream?: MediaStream;
    producerId?: string,
    producer?: Producer<AppData>,
}

export class VVRTC {
    private url : string;
    private emitter: EventEmitter;
    private device?: Device;
    private client?: Client;
    private users: Map<string, UserCell>;
    private camera: LocalCamera;
    private roomConfig?: JoinRoomConfig;
    private producerTransportId?: string;
    private producerTransport?: Transport<AppData>;
    // private producerRtpParam?: RtpParameters;
    private consumerTransport?: Transport<AppData>;

    private constructor(options: VVRTCOptions) {
        this.url = options.url || "ws://127.0.0.1:11080/ws";
        this.emitter = new EventEmitter();
        this.users = new Map;
        this.camera = {};
    }

    public static EVENT: typeof VVRTCEvent = VVRTCEvent;

    public static create(options?: VVRTCOptions): VVRTC
    {
        const vvrtc = new VVRTC(options || {});
        return vvrtc;
    }

    public async joinRoom(args: JoinRoomConfig): Promise<void>
    {
        if (!this.device) {
            const device = new Device();
            await device.load({
                routerRtpCapabilities: ROUTER_RTP_CAPABILITIES,
            });
            console.log("device loaded");
            this.device = device;
        }


        // const ws = new WebSocket(this.url);
        function connectWebSocket(url: string): Promise<WebSocket> {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(url);
        
                ws.addEventListener('open', (_event) => {
                    resolve(ws); // 连接成功时 resolve WebSocket 对象
                });
        
                ws.addEventListener('error', (error) => {
                    reject(error); // 连接出错时 reject
                });
            });
        }

        const ws = await connectWebSocket(this.url);

        const client = new Client(ws, args.userId);

        {
            const rsp = await client.open_session(args.roomId);
            console.log("opened session:", rsp);    
        }
        
        this.client = client;
        this.roomConfig = args;

        client.on("notice", async (notice: Notice) => {
            console.log("recv notice", notice);
            if (notice.body.User) {
                const user: User = notice.body.User;
                await this.updateUser(user);
            } else {
                console.warn("unknown notice", notice);
            }
        });

        await Promise.allSettled([
            this.createProducerTransport(),
            this.createConsumerTransport(),
        ]);

    }

    private async createProducerTransport() {
        if (this.producerTransport || !this.device || !this.client || !this.roomConfig) {
            return;
        }

        console.log("create server producer transport ...");
        const rsp = await this.client.create_producer_transport(this.roomConfig.roomId);
        console.log("created server producer transport", rsp);
        const transportId: string = rsp.xid;
        this.producerTransportId = transportId;

        this.producerTransport = this.device.createSendTransport({
            id             : transportId,
            iceParameters  : rsp.iceParam,
            iceCandidates  : rsp.iceCandidates,
            dtlsParameters : rsp.dtls,
            // appData        : ext,
            // sctpParameters : { ... }
        });
        console.log("created local send transport", this.producerTransport);

        this.producerTransport
            .on('connect', async ({ dtlsParameters }, success, fail) =>
            {
                // 创建第一个 producer 时才会执行到这里
                console.log("producerTransport on connect", dtlsParameters);
                
                try {
                    if (this.client && this.roomConfig && this.producerTransportId) {
                        const rsp = await this.client.connect_transport(this.roomConfig.roomId, this.producerTransportId, dtlsParameters);
                        console.log("connected producerTransport", this.producerTransportId, rsp);
                    }
                    
                    success();
                } catch (err) {
                    // Tell the transport that something was wrong.
                    const error = err instanceof Error ? err : new Error(String(err));
                    fail(error);
                }
            })
            .on('produce', async ({ kind, rtpParameters, appData }, success, fail) =>
            {
                console.log("producerTransport on produce", kind, rtpParameters);
                
                try {
                    let stream_id;	
                    if (kind == "audio") {
                        stream_id = "audio-stream";
                        // gState.audio_stream_id = stream_id;
                    } else {
                        stream_id = "video-stream";
                        // gState.video_stream_id = stream_id;
                    }


                    if (this.client && this.roomConfig && this.producerTransportId) {
                        const rsp = await this.client.publish(this.roomConfig.roomId, this.producerTransportId, stream_id, kind, rtpParameters);
                        appData.stream_id = stream_id;
                        console.log("published stream", stream_id, "transport", this.producerTransportId, rsp);
                        success({ id: rsp.producerId });
                    }
                    
                    
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    fail(error);
                }
            });
        this.checkPublish();
    }


    private async createConsumerTransport() {
        if (!this.device || !this.client || !this.roomConfig) {
            return;
        }

        if (this.consumerTransport) {
            return;
        }

        const device = this.device;
        const client = this.client;
        const roomId = this.roomConfig.roomId;
    
        let consumerTransport: Transport;
        let consumerTransportId: string ;
        {
            console.log("create server consumer transport ...");
            const rsp = await client.create_consumer_transport(this.roomConfig.roomId);
            console.log("created server consumer transport", rsp);
            consumerTransportId = rsp.xid;
    
            // rsp.dtlsParameters.role = "server";
            // rsp.dtlsParameters.fingerprints = [rsp.dtlsParameters.fingerprints];
    
            consumerTransport = device.createRecvTransport({
                id             : consumerTransportId,
                iceParameters  : rsp.iceParam,
                iceCandidates  : rsp.iceCandidates,
                dtlsParameters : rsp.dtls,
                // sctpParameters : { ... }
            });
            console.log("created local recv transport", consumerTransport);
        }
    
        consumerTransport.on('connect', async ({ dtlsParameters }, success, fail) => {
            console.log("consumer on connect", dtlsParameters);
    
            try {
                const rsp = await client.connect_transport(roomId, consumerTransportId, dtlsParameters);
                console.log("connected consumerTransport", consumerTransportId, rsp);
                success();
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                fail(error);
            }
        
        });
    
        this.consumerTransport = consumerTransport;

        await this.checkSubscribe();
    }

    public async openCamera(config?: CameraConfig) {
        if(!this.camera.stream) {
            this.camera.stream = await navigator.mediaDevices.getUserMedia({
                video : {
                    width : {
                        ideal : 1280
                    },
                    height : {
                        ideal : 720
                    },
                    frameRate : {
                        ideal : 30
                    }
                }
            });
            console.log("opened camera");
        }

        this.camera.config = config;

        if(config) {
            if(config.view) {
                config.view.srcObject = this.camera.stream;
            }
        }

        await this.checkCamera();

        // throw new Error(`元素 ID 不存在`);
    }

    private async checkCamera() {
        const camera = this.camera;

        if (!camera.stream || !camera.config) {
            return;
        }

        if (!camera.config.publish) {
            if (!camera.producerId) {
                return;
            }
            // TODO: unpub
        } else {
            if (camera.producerId || !camera.stream) {
                return;
            }

            if (!this.producerTransport) {
                return;
            }

            const track = camera.stream.getVideoTracks()[0];

            camera.producer = await this.producerTransport.produce({ track: track });
        }
    }

    public async watchUserCamera(config: UserVideoConfig) {
        let cell = this.users.get(config.userId);
        if(!cell) {
            throw new Error(`Not found user ${config.userId}`);
        }

        if (!cell.video) {
            cell.video = {};
        }

        cell.video.view = config.view;

        if (cell.video.track) {
            // 已经订阅过了
            checkVideoSource(cell.video.track.media, cell.video.view);
            return;
        }

        this.tryWatchUserCamera(cell);
        
    }

    private async tryWatchUserCamera(cell: UserCell) {
        const found = Object.entries(cell.user.streams)
        .find(([_key, stream]) => stream.kind == 2);

        if(!found) {
            // throw new Error(`Not found video stream for user ${config.userId}`);
            return
        }

        if (!cell.video?.track) {
            const [streamId, videoStream] = found;
            const track = await this.subscribeStream(streamId, videoStream);
            if (!track) {
                return ;
            }
    
            if (!cell.video) {
                cell.video = {};
            }
    
            cell.video.track = track;

            checkVideoSource(cell.video.track.media, cell.video.view);
        }
    }
    
    private async subscribeStream(streamId: string, stream: Stream) : Promise<ConsumeTrack|undefined> {
        if (!this.client || !this.roomConfig || !this.consumerTransport) {
            return undefined;
        }

        console.log("subscribing stream", streamId);
        const rsp = await this.client.subscribe(this.roomConfig.roomId, this.consumerTransport.id, streamId, stream.producer_id);
        console.log("subscribed", rsp);
    
        const consumer = await this.consumerTransport.consume({
            id: rsp.consumerId, 
            producerId: stream.producer_id, 
            kind: mediasoup_kind(stream.kind), 
            rtpParameters: rsp.rtp, 
            streamId,
        });
    
        console.log(`${consumer.kind} consumer created:`, consumer);
    
        return {
            streamId,
            producerId: stream.producer_id,
            consumerId: rsp.consumerId,
            media: consumer.track,
        };
    }

    private async updateUser(newUser: User): Promise<any> {
        // if(newUser.id == this.roomConfig?.userId) {
        //     return;
        // }

        let cell = this.users.get(newUser.id);
        if(!cell) {
            if(!newUser.online) {
                return;
            }

            cell = {
                user: {
                    id: newUser.id,
                    online: true,
                    streams: {},
                },
            };
            
            this.users.set(newUser.id, cell);

            this.trigger(VVRTC.EVENT.USER_JOIN, {
                userId: newUser.id,
            });

        } 

        this.checkUserEvent(cell, newUser);
    }

    private async checkUserEvent(cell: UserCell, newUser: User) {

        const oldUser = cell.user;

        if(!newUser.online) {

            this.users.delete(newUser.id);

            // TODO: 取消订阅等

            this.trigger(VVRTC.EVENT.USER_LEAVE, {
                userId: newUser.id,
            });

            return ;
        }

        cell.user = newUser;

        Object.keys(oldUser.streams).forEach(streamId => {
            if (!newUser.streams.hasOwnProperty(streamId)) {
                const stream = oldUser.streams[streamId];
                // 触发移除事件
                console.log("remove stream, user", newUser.id, stream);
            }
        });

        Object.keys(newUser.streams).forEach(streamId => {
            if (!oldUser.streams.hasOwnProperty(streamId)) {
                const stream = newUser.streams[streamId];
                // 触发添加事件
                console.log("add stream, user", newUser.id, stream);
                if (stream.kind == 2) {
                    this.trigger(VVRTC.EVENT.USER_CAMERA_ON, {
                        userId: newUser.id,
                    });
                }
            }
        });
    }

    private async checkPublish() {
        this.checkCamera();
    }

    private async checkSubscribe() {
        this.users.forEach( (cell, _userId) => {
            this.tryWatchUserCamera(cell);
        });
    }

    on<T extends keyof VVRTCEventTypes>(event: T, handler: (...args: VVRTCEventTypes[T]) => void): this {
        this.emitter.on(event, handler);
        return this;
    }

    // // 添加监听器
    // on<T>(event: string, listener: Listener<T>): void {
    //     this.emitter.on(event, listener);
    // }

    // 移除监听器
    off<T>(event: string, listener: Listener<T>): void {
        this.emitter.off(event, listener);
    }

    // 触发事件
    private trigger<T>(event: string, data: T): Boolean {
        return this.emitter.emit(event, data);
    }
}

function mediasoup_kind(kind: number): 'audio' | 'video' {
	return kind == 1 ? "audio" : "video"
}

function checkVideoSource(media?: MediaStreamTrack, view?: HTMLVideoElement): Boolean {
    // console.log("aaa checkVideoSource", media, view);
    
    if (media && view) {
        const combinedStream = new MediaStream();
        combinedStream.addTrack(media);
        view.srcObject = combinedStream;
        console.log("aaa assign video source", media);
        return true;
    } 
    return false;
}

