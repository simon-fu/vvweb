
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
    USER_CAMERA_OFF: 'user-video-off',
    USER_MIC_ON: 'user-audio-on',
    USER_MIC_OFF: 'user-audio-off',
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
    [VVRTCEvent.USER_CAMERA_OFF]: [{
		userId: string;
	}];
    [VVRTCEvent.USER_MIC_ON]: [{
		userId: string;
	}];
    [VVRTCEvent.USER_MIC_OFF]: [{
		userId: string;
	}];
}

export declare interface LocalCameraConfig {
	view?: HTMLVideoElement;
	publish?: boolean; // 加入房间后是否要发布，默认发布
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


export declare interface MicConfig {
    constraints?: boolean | MediaTrackConstraints;
	publish?: boolean; // 加入房间后是否要发布，默认发布  
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
    audio?: UserAudio,
}

interface UserVideo {
    view?: HTMLVideoElement,
    track?: ConsumeTrack,
}

interface UserAudio {
    view: HTMLAudioElement,
    track?: ConsumeTrack,
}

interface ConsumeTrack {
    streamId: string,
    producerId: string,
    consumerId?: string,
    media?: MediaStreamTrack,
}

interface LocalCamera {
    config?: LocalCameraConfig,
    stream?: MediaStream;
    // producerId?: string,
    producer?: Producer<AppData>,
}

interface LocalMic {
    config?: MicConfig,
    stream?: MediaStream;
    producerId?: string,
    producer?: Producer<AppData>,
    muted?: boolean,
    serverMuted?: boolean,
}

enum MKind {
    Audio = 1,
    Video = 2,
}

export class VVRTC {
    private url : string;
    private emitter: EventEmitter;
    private device?: Device;
    private client?: Client;
    private users: Map<string, UserCell>;
    private camera: LocalCamera;
    private mic: LocalMic;
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
        this.mic = {};
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

    public async openLocalCamera(config?: LocalCameraConfig) {
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
                        ideal : 60
                    }
                }
            });
            console.log("opened camera");
        }

        this.camera.config = config;

        await this.checkCamera();

        // throw new Error(`元素 ID 不存在`);
    }

    public async closeLocalCamera() {
        const camera = this.camera;

        if(camera.config) {
            if(camera.config.view ) {
                camera.config.view.srcObject = null;
            }
        }

        if (camera.stream) {
            camera.stream.getTracks().forEach(track => track.stop());
        }

        camera.stream = undefined;
        camera.config = undefined;

        await this.checkCamera();
    }

    // 配置麦克风参数，本接口不会真正打开/关闭麦克风  
    public async setMic(config?: MicConfig) {

        this.mic.config = config;

        await this.checkMic();
    }

    // 默认 muted = true，即不打开麦克风
    // 若加入房间前，设置 muted = true 会打开麦克风，设置 muted = false 会关闭麦克风  
    // 若加入房间后，第一次设置 muted = false 时打开麦克风，然后设置 muted = true，不会关闭麦克风，只是本地静音且服务器不转发音频数据。
    public async muteMic(muted: boolean) {
        this.mic.muted = muted;
        await this.checkMic();
    }

    private async checkCamera() {
        const camera = this.camera;

        if(camera.config) {
            if(camera.config.view && camera.stream) {
                if(camera.config.view.srcObject === null) {
                    camera.config.view.srcObject = camera.stream;
                }
            }
        }

        if (!camera.stream) {
            if (camera.producer && this.roomConfig) {
                const producerId = camera.producer.id;
                const rsp = await this.client?.unpublish(this.roomConfig?.roomId, producerId);
                camera.producer.close();
                camera.producer = undefined;
                console.log("unpublished camera producer", producerId, rsp);
            }

            return;
        }

        if (!camera.config) {
            return;
        }

        if (!camera.config.publish) {
            if (!camera.producer) {
                return;
            }
            // TODO: unpub
        } else {
            if (camera.producer || !camera.stream) {
                return;
            }

            if (!this.producerTransport) {
                return;
            }

            const track = camera.stream.getVideoTracks()[0];

            camera.producer = await this.producerTransport.produce({ track: track });
            console.log("produced camera", camera.producer);
        }
    }

    private async checkMic() {
        const mic = this.mic;

        const muted = mic.muted ?? true;             // 默认关闭麦克风
        const serverMuted = mic.serverMuted ?? true; // 默认关闭麦克风

        if(!mic.stream) {
            if (!muted) {
                const config = mic.config;
                this.mic.stream = await navigator.mediaDevices.getUserMedia({
                    audio: config && config.constraints !== undefined? config.constraints : true
                    // audio: {
                    //     echoCancellation: false // TODO: 正式代码要开启回音消除
                    // },
                });
                console.log("opened mic");
            }
        }

        if (!mic.stream) {
            return;
        }

        if (mic.producer && this.roomConfig) {
            if (muted != serverMuted) {
                const producerId = mic.producer.id;
                const rsp = await this.client?.mute(this.roomConfig?.roomId, producerId, muted);
                if (muted) {
                    mic.producer.pause();
                } else {
                    mic.producer.resume();
                }
                
                mic.serverMuted = muted;
                console.log("updated mic muted", muted, producerId, rsp);
            }

            return;
        }

        if (mic.muted) {
            if (!this.roomConfig) {
                mic.stream.getTracks().forEach(track => track.stop());
                mic.stream = undefined;
                console.log("closed mic");
                return;
            }
        }

        const pub = mic.config?.publish ?? true;

        if (!pub) {
            if (!mic.producerId) {
                return;
            }
            // TODO: unpub
        } else {
            if (mic.producerId || !mic.stream) {
                return;
            }

            if (!this.producerTransport) {
                return;
            }

            const track = mic.stream.getAudioTracks()[0];

            mic.producer = await this.producerTransport.produce({ track: track });
            mic.serverMuted = false; // TODO: 赋值发布时的 mute
            console.log("produced mic", mic.producer);
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

    // TODO: 修改参数跟TRTC一致  
    public async unwatchUserCamera(userId: string) {
        let cell = this.users.get(userId);
        if(!cell) {
            return ;
        }

        if (!this.client || !this.roomConfig) {
            return ;
        }

        const consumerId = cell.video?.track?.consumerId;
        if (!consumerId) {
            return ;
        }

        const rsp = await this.client.unsubscribe(this.roomConfig.roomId, consumerId);
        console.log("unsub consumer id", consumerId, "response", rsp);
        if (cell.video?.view) {
            cell.video.view.srcObject = null;
            cell.video.track = undefined;
        }
    }

    private async tryWatchUserCamera(cell: UserCell) {
        const found = Object.entries(cell.user.streams)
        .find(([_key, stream]) => stream.kind == MKind.Video);

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
    
    private async tryListenUserAudio(cell: UserCell) {
        const found = Object.entries(cell.user.streams)
        .find(([_key, stream]) => stream.kind == MKind.Audio);

        if(!found) {
            // throw new Error(`Not found audio stream for user ${config.userId}`);
            return
        }

        if (!cell.audio?.track) {
            const [streamId, videoStream] = found;
            const track = await this.subscribeStream(streamId, videoStream);
            if (!track) {
                return ;
            }
    
            if (!cell.audio) {
                const audioElement = document.createElement('audio') as HTMLAudioElement;
                document.body.appendChild(audioElement);
                cell.audio = {
                    view: audioElement,
                };
            }
    
            cell.audio.track = track;

            checkAudioSource(cell.audio.track.media, cell.audio.view);
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
                console.log("remove stream, user", newUser.id, stream);

                if (stream.kind == MKind.Video) {
                    if (cell.video) {
                        if (cell.video.track?.producerId == stream.producer_id) {
                            console.log("remove video track, producer_id", stream.producer_id);
                            cell.video.track = undefined;

                            if (cell.video.view) {
                                cell.video.view.srcObject = null;
                            }
                        }
                    }

                    this.trigger(VVRTC.EVENT.USER_CAMERA_OFF, {
                        userId: newUser.id,
                    });
                } else if (stream.kind == MKind.Audio) {
                    if (cell.audio) {
                        if (cell.audio.track?.producerId == stream.producer_id) {
                            console.log("remove audio track, producer_id", stream.producer_id);
                            cell.audio.track = undefined;

                            if (cell.audio.view) {
                                cell.audio.view.srcObject = null;
                            }
                        }
                    }
                }

            }
        });

        Object.keys(newUser.streams).forEach(streamId => {

            const newStream = newUser.streams[streamId];

            if (!oldUser.streams.hasOwnProperty(streamId)) {
                
                // 触发添加事件
                console.log("add stream, user", newUser.id, newStream);
                if (newStream.kind == MKind.Video) {
                    this.trigger(VVRTC.EVENT.USER_CAMERA_ON, {
                        userId: newUser.id,
                    });
                } else if (newStream.kind == MKind.Audio) {
                    if (!newStream.muted) {
                        this.trigger(VVRTC.EVENT.USER_MIC_ON, {
                            userId: newUser.id,
                        });
                    }
                    this.tryListenUserAudio(cell);
                } else {
                    console.warn("unknown stream media kind", newStream);
                }

            } else {

                const oldStream = oldUser.streams[streamId];
                if (oldStream.muted != newStream.muted) {
                    if (newStream.kind == MKind.Audio) {
                        if (!newStream.muted) {
                            this.trigger(VVRTC.EVENT.USER_MIC_ON, {
                                userId: newUser.id,
                            });
                        } else {
                            this.trigger(VVRTC.EVENT.USER_MIC_OFF, {
                                userId: newUser.id,
                            });
                        }
                    }
                }
            }
        });
    }

    private async checkPublish() {
        this.checkCamera();
        this.checkMic();
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
	return kind == MKind.Audio ? "audio" : "video"
}

function checkVideoSource(media?: MediaStreamTrack, view?: HTMLVideoElement): Boolean {
    
    if (media && view) {
        const combinedStream = new MediaStream();
        combinedStream.addTrack(media);
        view.srcObject = combinedStream;
        console.log("aaa assign video source", media);
        return true;
    } 
    return false;
}

function checkAudioSource(media?: MediaStreamTrack, view?: HTMLAudioElement): Boolean {
    
    if (media && view) {
        const combinedStream = new MediaStream();
        combinedStream.addTrack(media);
        view.srcObject = combinedStream;
        console.log("aaa assign audio source", media);

        view.play().catch((error) => {
            console.error('play audio failed:', error);
        });
        
        return true;
    } 
    return false;
}


