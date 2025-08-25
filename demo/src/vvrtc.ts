
import { Device } from 'mediasoup-client';
import { Transport } from 'mediasoup-client/lib/Transport';
import { AppData, Producer, Consumer } from 'mediasoup-client/lib/types';
import { Client, User, Notice, Stream} from "./client";
// import { EventEmitter, Listener } from "./emitter";
import { ROUTER_RTP_CAPABILITIES } from './rtp_capabilities';

export interface VVRTCOptions {
    url?: string,
}

export interface JoinRoomConfig {
	userId: string;
	roomId: string;
    userExt?: string;
    watchMe?: boolean;
}

export interface Statistics {
	rtt: number;
	downLoss: number;
	upLoss: number;
	bytesSent: number;
	bytesReceived: number;
	localStatistics: LocalStatistic;
	// remoteStatistics: RemoteStatistic[];
    remoteStatistics: Map<string, RemoteStatistic>;
}

export interface VideoStatistic {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
    // videoType: VideoType;
}

export interface AudioStatistic {
    bitrate: number;
    // audioLevel: number;
}

export interface LocalStatistic {
	audio?: AudioStatistic;
	video: VideoStatistic[];
}
// export declare enum VideoType {
// 	Big = 'big',
// 	Small = 'small',
// 	Sub = 'sub'
// }

export enum VideoType {
	Camera = 'camera',
	Screen = 'screen',
}

export interface RemoteVideoStatistic {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
    videoType: VideoType;
}

export interface RemoteStatistic {
	audio?: AudioStatistic;
	video?: RemoteVideoStatistic[];
	userId: string;
}

export interface UserVolume {
    userId: string;
    volume: number;
}


export const VVRTCEvent = {
    USER_JOIN: 'user-join',
    USER_LEAVE: 'user-leave',
    USER_CAMERA_ON: 'user-video-on',
    USER_CAMERA_OFF: 'user-video-off',
    USER_MIC_ON: 'user-audio-on',
    USER_MIC_OFF: 'user-audio-off',
    USER_SCREEN_ON: 'user-screen-on',
    USER_SCREEN_OFF: 'user-screen-off',
    STATISTICS: 'statistics',
    AUDIO_VOLUME: 'audio-volume',
    TALKING_USERS: 'talking-users',
    CLOSED_BY_SERVER: 'closed-by-server'
    
} as const; 


export declare interface VVRTCEventTypes {
	[VVRTCEvent.USER_JOIN]: [{
		userId: string;
        userExt?: string;
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
    [VVRTCEvent.USER_SCREEN_ON]: [{
		userId: string;
	}];
    [VVRTCEvent.USER_SCREEN_OFF]: [{
		userId: string;
	}];
    [VVRTCEvent.STATISTICS]: [statistics: Statistics];

    [VVRTCEvent.AUDIO_VOLUME]: [{
        // 当前正在说话的用户
		volumes: UserVolume[]; 
	}];
    [VVRTCEvent.TALKING_USERS]: [{
        users: string[];
    }];
    [VVRTCEvent.CLOSED_BY_SERVER]: [{
        code: number;
        reason: string;
    }];
    
}

class VVRTCEmitter {
    // 内部存储：每个事件名对应一组 handler
    private _handlers: {
        [K in keyof VVRTCEventTypes]?: Array<(...args: VVRTCEventTypes[K]) => void>
    } = {};

    // 注册事件
    on<T extends keyof VVRTCEventTypes>(
        event: T,
        handler: (...args: VVRTCEventTypes[T]) => void,
        context?: any,
    ): this {
        const fn = context ? handler.bind(context) : handler;
        if (!this._handlers[event]) {
        this._handlers[event] = [];
        }
        this._handlers[event]!.push(fn);
        return this;
    }

    // // 注销事件（可选）
    // off<T extends keyof VVRTCEventTypes>(
    //     event: T,
    //     handler?: (...args: VVRTCEventTypes[T]) => void,
    // ): this {
    //     if (!handler) {
    //         // 如果不传 handler，则移除该事件所有监听
    //         delete this._handlers[event];
    //     } else {
    //         const handlers = this._handlers[event];
    //         if (handlers) {
    //             this._handlers[event] = handlers.filter(h => h !== handler);
    //         }
    //     }
    //     return this;
    // }

    // 触发事件
    emit<T extends keyof VVRTCEventTypes>(
        event: T,
        ...args: VVRTCEventTypes[T]
    ): this {
        const handlers = this._handlers[event];
        if (handlers) {
        // 复制一份，防止回调中修改数组
        handlers.slice().forEach(h => h(...args));
        }
        return this;
    }
}

export declare interface LocalCameraConfig {
	view?: HTMLVideoElement;
	publish?: boolean; // 加入房间后是否要发布，默认发布
    small?: boolean; // 是否开启小流，默认不开启
    constraints?: MediaTrackConstraints;
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
	option?: {
	// 	fillMode?: 'contain' | 'cover' | 'fill';
	// 	mirror?: boolean;
		small?: boolean;
	// 	receiveWhenViewVisible?: boolean;
	// 	viewRoot?: HTMLElement;
	// 	canvasRender?: boolean;
	};
}

interface UserCell {
    user: User,
    video?: UserVideo,
    audio?: UserAudio,
    screen?: UserVideo,
}

interface UserVideo {
    view?: HTMLVideoElement, // TODO: 去掉，使用 config.view
    track?: ConsumeTrack,
    config: UserVideoConfig,
}

interface UserAudio {
    view: HTMLAudioElement,
    track?: ConsumeTrack,
}

interface ConsumeTrack {
    streamId: string,
    producerId: string,
    // consumerId?: string,
    consumer: Consumer<AppData>,
    // media?: MediaStreamTrack,
}

interface LocalCamera {
    config?: LocalCameraConfig,
    active?: LocalCameraConfig,
    stream?: MediaStream;
    producer?: Producer<AppData>,
    updated?: string,
    checking?: boolean,
}

interface LocalMic {
    config?: MicConfig,
    active?: MicConfig,
    stream?: MediaStream;
    // producerId?: string,
    producer?: Producer<AppData>,
    
    muted?: boolean,
    serverMuted?: boolean,

    updated?: string,
    checking?: boolean,
}

interface LocalShareScreen {
    stream?: MediaStream,
    producer?: Producer<AppData>,
}

// enum MKind {
//     Audio = 1,
//     Video = 2,
// }

enum StreamType {
    Camera = 1,
    Mic = 2,
    Screen = 3,
}

interface LastSent {
    id: string,
    frames: number,
    bytes: number,
    timestamp: number,
}


interface StatiState {
    lastSentVideos: LastSent[]; 
    lastSentAudio: LastSent[]; 
    lastRecvVideos: LastSent[]; 
    lastRecvAudios: LastSent[]; 
    // statiVideos: [VideoStatistic]; 
}

interface ProducerAppData extends AppData{
    // [key: string]: unknown;
    // mediaTag: 'camera' | 'screen' | 'mic';
    // streamId: string;
    info: ProducerInfo
}

interface ProducerInfo {
    // mediaTag: 'camera' | 'screen' | 'mic';
    stype: StreamType;
    streamId: string;
}

export class VVRTC {
    private url : string;
    // private emitter: EventEmitter;
    private emitter: VVRTCEmitter;
    private device?: Device;
    private client?: Client;
    private users: Map<string, UserCell>;
    private camera: LocalCamera;
    private screen: LocalShareScreen;
    private mic: LocalMic;
    
    private roomConfig?: JoinRoomConfig;
    private producerTransportId?: string;
    private producerTransport?: Transport<AppData>;
    // private producerRtpParam?: RtpParameters;
    private consumerTransport?: Transport<AppData>;
    private stats: StatiState;
    private statsIntervalId?: NodeJS.Timeout;

    private talkingUsers: string[];
    private talkingEventIntervalId?: NodeJS.Timeout;
    private evalVolumeIntervalId?: NodeJS.Timeout;

    private userVolumes?: UserVolume[];
    private volumeEventIntervalId?: NodeJS.Timeout;

    private constructor(options: VVRTCOptions) {
        this.url = options.url || "ws://127.0.0.1:11080/ws";
        this.emitter = new VVRTCEmitter();
        this.users = new Map;
        this.camera = {};
        this.screen = {};
        this.mic = {};
        this.talkingUsers = [];
        // this.userVolumes = [];
        this.stats = {
            lastSentVideos: [],
            lastRecvVideos: [],
            lastSentAudio: [],
            lastRecvAudios: [],
        };

    }

    public enableStats(interval?: number) {
        if(interval && interval <=0 ) {
            if(this.statsIntervalId) {
                clearInterval(this.statsIntervalId);
                this.statsIntervalId = undefined;
            }
            return;
        }

        const safeInterval = Math.max(interval ?? 1500, 1000);
        this.statsIntervalId = setInterval(async () => {
            await this.getStats();
        }, safeInterval);
    }
    
    public enableTalkingUsers(interval?: number) {
        if(interval && interval <=0 ) {
            if(this.talkingEventIntervalId) {
                clearInterval(this.talkingEventIntervalId);
                this.talkingEventIntervalId = undefined;
            }
            
            this.stopEvalVolume();
            
            return;
        }

        const safeInterval = Math.max(interval ?? 1000, 500);
        this.talkingEventIntervalId = setInterval(() => {
            const users = this.talkingUsers;
            this.talkingUsers = [];
            this.trigger(VVRTC.EVENT.TALKING_USERS, {
                users,
            });
        }, safeInterval);

        this.startEvalVolume();
    }

    private async evalAudioVolume(): Promise<UserVolume[]> {

        const volumes: UserVolume[] = [];

        this.users.forEach(async (cell, userId) => {
            if(!cell.audio?.track) {
                return;
            }

            const { rtpReceiver } = cell.audio.track.consumer;
            if(!rtpReceiver) {
                return;
            }

            const sources = rtpReceiver.getSynchronizationSources();

            sources.forEach(src => {
                // audioLevel: 0.0 ~ 1.0
                // console.log(`SSRC ${src.source} 的音量：`, src.audioLevel);
                if(src.audioLevel) {
                    if(src.audioLevel >= 0.01) {
                        const exists = this.talkingUsers.some(u => u === userId);
                        if(!exists) {
                            this.talkingUsers.push(userId);
                        }
                    }
                    volumes.push({
                        userId,
                        volume: src.audioLevel,
                    });
                }
            });
            
        });

        if(this.mic.producer && this.mic.producer.rtpSender) {
            const stats = await this.mic.producer.rtpSender.getStats();
            stats.forEach(report => {
                if (report.type === 'media-source'
                    && report.kind === 'audio'
                    && report.audioLevel !== undefined
                ) {
                    const level: number = report.audioLevel;
                    // console.log('local audioLevel:', level);
                    if(level >= 0.01 && this.roomConfig) {
                        const userId = ""; // this.roomConfig.userId;
                        const exists = this.talkingUsers.some(u => u === userId);
                        if(!exists) {
                            this.talkingUsers.push(userId);
                        }
                    }
                    volumes.push({
                        userId: "",
                        volume: level,
                    })
                }
            });
        }

        // this.userVolumes = volumes;
        return volumes;

    }

    public enableAudioVolume(interval?: number) {
        if(interval && interval <=0 ) {
            if(this.volumeEventIntervalId) {
                clearInterval(this.volumeEventIntervalId);
                this.volumeEventIntervalId = undefined;
            }
            return;
        }

        const safeInterval = Math.max(interval ?? 1000, 200);
        this.volumeEventIntervalId = setInterval(async () => {
            let volumes ;
            if(!this.userVolumes) {
                volumes = await this.evalAudioVolume();
            } else {
                volumes = this.userVolumes;
                this.userVolumes = undefined;
            }

            this.trigger(VVRTC.EVENT.AUDIO_VOLUME, {
                volumes,
            });
        }, safeInterval);
    }

    private startEvalVolume() {
        if(!this.evalVolumeIntervalId) {
            this.evalVolumeIntervalId = setInterval(async () => {
                this.userVolumes = await this.evalAudioVolume();
            }, 100);
        }
    }

    private stopEvalVolume() {
        if(this.talkingEventIntervalId || this.volumeEventIntervalId) {
            return;
        }

        if(this.evalVolumeIntervalId) {
            clearInterval(this.evalVolumeIntervalId);
            this.evalVolumeIntervalId = undefined;
        }
    }

    private async getStats() {
        // TODO: 先 await Promise.all 获取stats数据，再处理 

        // const local = await this.getOutboundVideos();
        const local: LocalStatistic = {
            video: await this.getOutboundVideos(),
            audio: await this.getOutboundAudio(),
        };
        
        const remote = new Map<string, RemoteStatistic>();
        {
            await this.getInboundVideos(remote);
            await this.getInboundAudios(remote);
        }

        this.trigger(VVRTC.EVENT.STATISTICS, {
            rtt: 0,
            downLoss: 0,
            upLoss: 0,
            bytesSent: 0,
            bytesReceived: 0,
            localStatistics: local,
            remoteStatistics: remote,
        });
    }

    private async getInboundVideos(userMap: Map<string, RemoteStatistic>) : Promise<void> {
        const inboundVideos: any[] = [];
        const tasks: Promise<void>[] = []; 

        this.users.forEach((cell, userId) => {
            const task = (async () => {
                if (cell.video?.track) {
                    const stats = await cell.video.track.consumer.getStats();
                    const reports: any[] = [];
                    stats.forEach((stat) => {
                        // console.log("consumer state", stat);
                        if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
                            // console.log("consumer inbound video", stat);
                            reports.push(stat);
                            // inboundVideos.push(stat);
                        }
                    });           
                    inboundVideos.push({userId, reports, stype: StreamType.Camera});
                }
                if (cell.screen?.track) {
                    const stats = await cell.screen.track.consumer.getStats();
                    const reports: any[] = [];
                    stats.forEach((stat) => {
                        // console.log("consumer state", stat);
                        if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
                            // console.log("consumer inbound video", stat);
                            reports.push(stat);
                            // inboundVideos.push(stat);
                        }
                    });           
                    inboundVideos.push({userId, reports, stype: StreamType.Screen});
                }
            })();
            tasks.push(task);
        });
        
        // wait for all of them
        await Promise.all(tasks)

        
        // console.log("inboundVideos", inboundVideos.length, inboundVideos );

        // 移除不存在的元素
        const lasts = this.stats.lastRecvVideos.filter(last => {
            const found = inboundVideos.some((item: {userId: string, reports: any[]}) => {
                return item.reports.some((current: any) => {
                    let equal = current.id === last.id;
                    // console.log("current", current.id, "last", last.id, "equal", equal);
                    return equal;
                });
            });
            return found;
        });

        this.stats.lastRecvVideos = [];

        const remotes: RemoteStatistic[] = [];

        inboundVideos.forEach((item: {userId: string, reports: any[], stype: StreamType}) => {
            const userId = item.userId;
            const reports = item.reports;
            const stype = item.stype;
            
            // const userStat: RemoteStatistic = {
            //     userId,
            // }; 

            let userStat = userMap.get(userId);
            if (!userStat) {
                userStat = { 
                    userId,
                };
                userMap.set(userId, userStat);
            }

            reports.forEach(stat => {
                // console.log("", userId, stat);

                const current: LastSent = {
                    id: stat.id,
                    frames: stat.framesDecoded ?? 0,
                    bytes: stat.bytesReceived ?? 0,
                    timestamp: stat.timestamp ?? 0,
                };
    
                this.stats.lastRecvVideos.push(current);
    
                let last = lasts.find(ele => ele.id === stat.id);
    
                if (!last) {
                    last = current;
                }
    
                const elapsed = current.timestamp - last.timestamp;
    
                // 至少要经过100毫秒
                if (elapsed < 100) {
                    return;
                }

                if (!userStat) {
                    return;
                }

                let videoType: VideoType;

                switch (stype) {
                    case StreamType.Camera:
                        videoType = VideoType.Camera;
                        break;
                    case StreamType.Screen:
                        videoType = VideoType.Screen
                        break;
                    default:
                        return;
                }


                if (!userStat.video) {
                    userStat.video = [];
                }

                userStat.video.push({
                    width: stat.frameWidth ?? 0,
                    height: stat.frameHeight ?? 0,
                    frameRate: Math.floor((current.frames - last.frames) / (elapsed/1000)),
                    bitrate: Math.floor(((current.bytes - last.bytes) * 8) / (elapsed/1000)/1000),
                    videoType,
                });

                // console.log("current ", current, "last", last);
            });

            remotes.push(userStat);
        });

        // console.log("lastRecvVideos inbound video", this.stats.lastRecvVideos.length, this.stats.lastRecvVideos );
        // console.log("remotes ", remotes );

        // return remotes;
        return ;
    }

    private async getInboundAudios(userMap: Map<string, RemoteStatistic>) : Promise<void> {
        const inboundVideos: any[] = [];
        const tasks: Promise<void>[] = []; 

        this.users.forEach((cell, userId) => {
            const task = (async () => {
                if (cell.audio?.track) {
                    const stats = await cell.audio.track.consumer.getStats();
                    const reports: any[] = [];
                    stats.forEach((stat) => {
                        // console.log("consumer state", stat);
                        if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
                            // console.log("consumer inbound video", stat);
                            reports.push(stat);
                            // inboundVideos.push(stat);
                        }
                    });           
                    inboundVideos.push({userId, reports, stype: StreamType.Mic});
                }
            })();
            tasks.push(task);
        });
        
        // wait for all of them
        await Promise.all(tasks)

        
        // console.log("inboundVideos", inboundVideos.length, inboundVideos );

        // 移除不存在的元素
        const lasts = this.stats.lastRecvAudios.filter(last => {
            const found = inboundVideos.some((item: {userId: string, reports: any[]}) => {
                return item.reports.some((current: any) => {
                    let equal = current.id === last.id;
                    // console.log("current", current.id, "last", last.id, "equal", equal);
                    return equal;
                });
            });
            return found;
        });

        this.stats.lastRecvAudios = [];

        const remotes: RemoteStatistic[] = [];

        inboundVideos.forEach((item: {userId: string, reports: any[], stype: StreamType}) => {
            const userId = item.userId;
            const reports = item.reports;
            
            // const userStat: RemoteStatistic = {
            //     userId,
            // }; 

            let userStat = userMap.get(userId);
            if (!userStat) {
                userStat = { 
                    userId,
                };
                userMap.set(userId, userStat);
            }

            reports.forEach(stat => {
                // console.log("", userId, stat);

                const current: LastSent = {
                    id: stat.id,
                    frames: stat.framesDecoded ?? 0,
                    bytes: stat.bytesReceived ?? 0,
                    timestamp: stat.timestamp ?? 0,
                };
    
                this.stats.lastRecvAudios.push(current);
    
                let last = lasts.find(ele => ele.id === stat.id);
    
                if (!last) {
                    last = current;
                }
    
                const elapsed = current.timestamp - last.timestamp;
    
                // 至少要经过100毫秒
                if (elapsed < 100) {
                    return;
                }

                if (!userStat) {
                    return;
                }

                userStat.audio = {
                    bitrate: Math.floor(((current.bytes - last.bytes) * 8) / (elapsed/1000)/1000),
                };

                // console.log("current ", current, "last", last);
            });

            remotes.push(userStat);
        });

        // console.log("remotes ", remotes );

        return;
    }

    private async getOutboundVideos() : Promise<VideoStatistic[]> {

        const outboundVideos: any[] = [];

        if (this.camera.producer) {
            const stats = await this.camera.producer.getStats();

            stats.forEach((stat) => {
                // console.log(stat);
                if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
                    // console.log("producer outbound video", stat);
                    outboundVideos.push(stat);
                }
            });
        }

        // 移除存在上一次但当前不存在的元素
        const filtered = this.stats.lastSentVideos.filter(last => {
            const found = outboundVideos.some(current => {
                let equal = current.id === last.id;
                // console.log("current", current.id, "last", last.id, "equal", equal);
                return equal;
            });
            // console.log("found", found);
            return found;
        });


        // const local: LocalStatistic = {
        //     video: [],
        // };

        const videos: VideoStatistic[] = [];

        const lasts = filtered;
        this.stats.lastSentVideos = [];

        outboundVideos.forEach((stat) => {
            const current: LastSent = {
                id: stat.id,
                frames: stat.framesSent ?? 0,
                bytes: stat.bytesSent ?? 0,
                timestamp: stat.timestamp ?? 0,
            };

            this.stats.lastSentVideos.push(current);

            let last = lasts.find(ele => ele.id === stat.id);

            if (!last) {
                last = current;
            }

            const elapsed = current.timestamp - last.timestamp;

            // 至少要经过100毫秒
            if (elapsed < 100) {
                return;
            }

            videos.push({
                width: stat.frameWidth ?? 0,
                height: stat.frameHeight ?? 0,
                frameRate: Math.floor((current.frames - last.frames) / (elapsed/1000)),
                bitrate: Math.floor(((current.bytes - last.bytes) * 8) / (elapsed/1000)/1000),
            });

        });

        // console.log("videos stati", videos);
        return videos;


    }

    private async getOutboundAudio() : Promise<AudioStatistic|undefined> {

        const outbounds: any[] = [];


        if (this.mic.producer) {
            const stats = await this.mic.producer.getStats();

            stats.forEach((stat) => {
                // console.log(stat);
                if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
                    // console.log("producer outbound audio", stat);
                    outbounds.push(stat);
                }
            });
        }

        // 移除存在上一次但当前不存在的元素
        const filtered = this.stats.lastSentAudio.filter(last => {
            const found = outbounds.some(current => {
                let equal = current.id === last.id;
                // console.log("current", current.id, "last", last.id, "equal", equal);
                return equal;
            });
            // console.log("found", found);
            return found;
        });


        const statss: AudioStatistic[] = [];

        const lasts = filtered;
        this.stats.lastSentAudio = [];

        outbounds.forEach((stat) => {
            const current: LastSent = {
                id: stat.id,
                frames: stat.framesSent ?? 0,
                bytes: stat.bytesSent ?? 0,
                timestamp: stat.timestamp ?? 0,
            };

            this.stats.lastSentAudio.push(current);

            let last = lasts.find(ele => ele.id === stat.id);

            if (!last) {
                last = current;
            }

            const elapsed = current.timestamp - last.timestamp;

            // 至少要经过100毫秒
            if (elapsed < 100) {
                return;
            }

            statss.push({
                bitrate: Math.floor(((current.bytes - last.bytes) * 8) / (elapsed/1000)/1000),
                // audioLevel: 0,
            });

        });

        // console.log("audio stati", statss);
        if (statss.length > 0) {
            return statss[0];
        } else {
            return undefined;
        }

    }

    public static EVENT: typeof VVRTCEvent = VVRTCEvent;

    public static create(options?: VVRTCOptions): VVRTC {
        const vvrtc = new VVRTC(options || {});
        return vvrtc;
    }

    public async joinRoom(args: JoinRoomConfig): Promise<void> {
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
            const rsp = await client.open_session(args.roomId, args.userExt);
            console.log("opened session response  ", rsp);    
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

        client.on("closed", async (ev: any) => {
            console.log("recv closed: ", ev); 

            await this.cleanUp();

            const { code, reason } = ev.status; 
            this.trigger(VVRTC.EVENT.CLOSED_BY_SERVER, {
                code,
                reason,
            });
        });

        setTimeout(async () => {
            try {
                await Promise.all([
                    this.createProducerTransport(),
                    this.createConsumerTransport(),
                ]);
            } catch(error) {
                console.warn("create transport error", error);
                // throw error;
            }

        }, 0);


    }

    public async leaveRoom(): Promise<boolean> {
        if(!this.client || !this.roomConfig) {
            return false;
        }

        const rsp = await this.client.close_session(this.roomConfig.roomId);
        console.log("closed session response", rsp);   

        await this.cleanUp();

        return true;
    }

    public async endRoom(): Promise<boolean> {
        if(!this.client || !this.roomConfig) {
            return false;
        }

        const rsp = await this.client.end_room(this.roomConfig.roomId);
        console.log("end room response", rsp);   

        await this.cleanUp();
        return true;
    }

    private async cleanUp() {
        this.users.forEach(async cell => {
            this.cleanUser(cell);
        });
        this.users.clear();

        // 避免关闭 camera/mic 时 unpublish
        this.client = undefined;

        await this.closeLocalCamera();
  
        // this.camera.config = undefined;
        // this.camera.stream = undefined;
        // this.camera.producer = undefined;

        await this.closeLocalMic();

        // this.mic.config = undefined;
        // this.mic.muted = undefined;
        // this.mic.producer = undefined;
        // // this.mic.producerId = undefined;
        // this.mic.serverMuted = undefined;
        // this.mic.stream = undefined;

        this.screen.producer = undefined;
        this.screen.stream = undefined;

        this.roomConfig = undefined;
        this.producerTransportId = undefined;
        this.producerTransport = undefined;
        this.consumerTransport = undefined;

    }

    private cleanUser(cell: UserCell) {
        if (cell.audio) {
            document.body.removeChild(cell.audio.view);
            cell.audio = undefined; // 方便检测音量等操作检测到结束
        }
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
            .on('connect', async ({ dtlsParameters }, success, _fail) =>
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
                    // TODO: 如果调用 fail(error) 会导致未处理的错误
                    console.warn("connect_transport error", err);
                    success();
                    // const error = err instanceof Error ? err : new Error(String(err));
                    // fail(error);
                }
            })
            .on('produce', async ({ kind, rtpParameters, appData }, success, fail) =>
            {
                const info = (appData as ProducerAppData).info;
                console.log("producerTransport on produce", kind, rtpParameters, "stype", info.stype, "streamId", info.streamId);

                try {
                    let stream_id = info.streamId;	
                    // if (kind == "audio") {
                    //     stream_id = "audio-stream";
                    //     // gState.audio_stream_id = stream_id;
                    // } else {
                    //     stream_id = "video-stream";
                    //     // gState.video_stream_id = stream_id;
                    // }


                    if (this.client && this.roomConfig && this.producerTransportId) {
                        const rsp = await this.client.publish(this.roomConfig.roomId, this.producerTransportId, stream_id, info.stype, rtpParameters);
                        // appData.stream_id = stream_id;
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
    
        consumerTransport.on('connect', async ({ dtlsParameters }, success, _fail) => {
            console.log("consumer on connect", dtlsParameters);
    
            try {
                const rsp = await client.connect_transport(roomId, consumerTransportId, dtlsParameters);
                console.log("connected consumerTransport", consumerTransportId, rsp);
                success();
            } catch (err) {
                // TODO: 如果调用 fail(error) 会导致未处理的错误
                console.warn("connect_transport error", err);
                success();
                // const error = err instanceof Error ? err : new Error(String(err));
                // fail(error);
            }
        
        });
    
        this.consumerTransport = consumerTransport;

        await this.checkSubscribe();
    }

    public async openLocalCamera(config?: LocalCameraConfig) {
        if (!config) {
            config = {};
        }

        this.camera.config = config;

        this.camera.updated = "openLocalCamera";

        await this.checkCamera();
    }

    public async closeLocalCamera() {

        this.camera.config = undefined;

        this.camera.updated = "closeLocalCamera";

        await this.checkCamera();
    }

    // // 配置麦克风参数，本接口不会真正打开/关闭麦克风  
    // public async setMic(config?: MicConfig) {

    //     this.mic.config = config;

    //     await this.checkMic();
    // }

    public async openLocalMic(config?: MicConfig) {
        if (!config) {
            config = {};
        }
        this.mic.config = config;

        this.mic.updated = "openLocalMic";

        await this.checkMic();
    }

    public async closeLocalMic() {
        this.mic.config = undefined;

        this.mic.updated = "closeLocalMic";

        await this.checkMic();
    }

    public isOpenMic() : boolean {
        if(this.mic.config) {
            return true;
        } else {
            return false;
        }
    }

    // 默认 muted = true，即不打开麦克风
    // 若加入房间前，设置 muted = true 会打开麦克风，设置 muted = false 会关闭麦克风  
    // 若加入房间后，第一次设置 muted = false 时打开麦克风，然后设置 muted = true，不会关闭麦克风，只是本地静音且服务器不转发音频数据。
    public async muteMic(muted: boolean) {
        this.mic.muted = muted;
        this.mic.updated = "muteMic";
        await this.checkMic();
    }

    private async checkCamera(reason?: string) {
        if(reason) {
            this.camera.updated = reason;
        }

        if (this.camera.checking) {
            return;
        }

        this.camera.checking = true;

        while(this.camera.updated) {
            console.log("check camera updated", this.camera.updated);
            this.camera.updated = undefined;
            // await this.checkCameraOnce();

            {
                const config = this.camera.config;
                
                if (!config) {
                    // 处理关闭请求
                    await this.checkCameraOff();
                    this.camera.active = undefined;
                } else {
                    // 处理打开请求
                    await this.checkCameraOn(config);
                    this.camera.active = config;
                }
            }
        } 

        this.camera.checking = false;
    }



    private async checkCameraOff() {
        const camera = this.camera;

        // 关掉预览
        if (camera.active) {
            if(camera.active.view) {
                console.log("disable preview camera");
                camera.active.view.srcObject = null;
            }
            camera.active = undefined;
        }

        // 关闭摄像头
        if (camera.stream) {
            camera.stream.getTracks().forEach(track => track.stop());
            camera.stream = undefined;
            console.log("closed camera");
        }

        // 取消发布
        if (camera.producer ) {

            const producerId = camera.producer.id;

            if (this.roomConfig && this.client) {
                console.log("unpublish camera (reason: close) ...")
                // TODO: 捕获异常并处理
                const rsp = await this.client.unpublish(this.roomConfig?.roomId, producerId);
                console.log("unpublished camera (reason: close)", producerId, rsp);
            } else {
                console.log("ignore unpublish camera, client", this.client, "roomConfig", this.roomConfig)
            }
            
            camera.producer.close();
            camera.producer = undefined;
            console.log("closed camera producer (reason: close)", producerId);
        }
    }



    private async checkCameraOn(config: LocalCameraConfig) {
        const camera = this.camera;

        if(camera.stream) {
            // TODO: 检查摄像头参数 constraints 参数不一致时重现打开摄像头
        }

        // 打开摄像头
        if(!camera.stream) {
            const video = config.constraints || true;
            console.log("opening camera, constraints", video);
            this.camera.stream = await navigator.mediaDevices.getUserMedia({ video });
            // this.camera.stream = await navigator.mediaDevices.getUserMedia({
            //     video : {
            //         width : {
            //             ideal : 1280
            //         },
            //         height : {
            //             ideal : 720
            //         },
            //         frameRate : {
            //             ideal : 60
            //         }
            //     }
            // });
            console.log("opened camera");
        }

        // 开启预览
        if(config.view && camera.stream) {
            if(config.view.srcObject === null) {
                console.log("enable preview camera");
                config.view.srcObject = camera.stream;
            }
        }

        const is_pub = config.publish || true;

        if (!is_pub) {
            if (camera.producer && this.client && this.roomConfig) {
                console.log("unpublish camera producer (reason: unpub) ...")
                const producerId = camera.producer.id;
                // TODO: 处理异常
                const rsp = await this.client.unpublish(this.roomConfig?.roomId, producerId);
                camera.producer.close();
                camera.producer = undefined;
                console.log("unpublished camera producer (reason: unpub)", producerId, rsp);
            }
        } else {

            if (!camera.producer && camera.stream && this.producerTransport && this.device) {
                const track = camera.stream.getVideoTracks()[0];
                const codec = this.device.rtpCapabilities.codecs?.find((codec) => codec.mimeType.toLowerCase() === 'video/vp8')
                let encodings;
                if (config.small) {
                    encodings = [
                        {scaleResolutionDownBy: 4, maxBitrate: 500000},
                        // {scaleResolutionDownBy: 2, maxBitrate: 1000000},
                        {scaleResolutionDownBy: 1, maxBitrate: 5000000}
                    ];
                }

                let appData: ProducerAppData = {
                    info: {
                        // mediaTag: 'camera',
                        stype: StreamType.Camera,
                        streamId: 'video_stream',
                    }
                };

                camera.producer = await this.producerTransport.produce({ 
                    track,
                    codec,
                    encodings,
                    appData,
                    // appData: { mediaTag: 'camera' },
                });

                console.log("produced camera", camera.producer);
            }
        }
    }

    private async checkMic(reason?: string) {
        if(reason) {
            this.mic.updated = reason;
        }

        if (this.mic.checking) {
            return;
        }

        this.mic.checking = true;

        while(this.mic.updated) {
            console.log("check mic updated", this.mic.updated);
            this.mic.updated = undefined;
            // await this.checkCameraOnce();

            {
                const config = this.mic.config;
                
                if (!config) {
                    // 处理关闭请求
                    await this.checkMicOff();
                    this.mic.active = undefined;
                } else {
                    // 处理打开请求
                    await this.checkMicOn(config);
                    this.mic.active = config;
                }
            }
        } 

        this.mic.checking = false;
    }

    private async checkMicOff() {
        const mic = this.mic;

        // 关闭麦克风
        if (mic.stream) {
            mic.stream.getTracks().forEach(track => track.stop());
            mic.stream = undefined;
            console.log("closed mic");
        }

        // 取消发布
        if (mic.producer ) {

            const producerId = mic.producer.id;

            if (this.roomConfig && this.client) {
                console.log("unpublish mic (reason: close) ...")
                // TODO: 捕获异常并处理
                const rsp = await this.client.unpublish(this.roomConfig?.roomId, producerId);
                console.log("unpublished mic (reason: close)", producerId, rsp);
            } else {
                console.log("ignore unpublish mic, client", this.client, "roomConfig", this.roomConfig)
            }
            
            mic.producer.close();
            mic.producer = undefined;
            console.log("closed mic producer (reason: close)", producerId);
        }
    }

    private async checkMicOn(config: MicConfig) {
        const mic = this.mic;
        const serverMuted = mic.serverMuted ?? false;
        const muted = mic.muted ?? false;             // 默认开启麦克风
        

        if(mic.stream) {
            // TODO: 检查参数 constraints 参数不一致时重现打开设备
        }

        // 打开设备
        if(!mic.stream) {
            if(!muted) {
                const audio = config.constraints !== undefined? config.constraints : true;

                console.log("opening mic, constraints", audio);
                this.mic.stream = await navigator.mediaDevices.getUserMedia({
                    audio
                });
                console.log("opened mic");
            }
        }

        const is_pub = config.publish || true;

        if (!is_pub) {
            if(mic.producer) {
                if(!mic.producer.paused) {
                    console.log("pause mic producer (reason: unpub)");
                    mic.producer.pause();
                }

                if(this.client && this.roomConfig) {
                    console.log("unpublish mic producer (reason: unpub) ...")
                    const producerId = mic.producer.id;
                    // TODO: 处理异常
                    const rsp = await this.client.unpublish(this.roomConfig?.roomId, producerId);
                    mic.producer.close();
                    mic.producer = undefined;
                    console.log("unpublished mic producer (reason: unpub)", producerId, rsp);
                }
            }

        } else {

            if (!mic.producer && mic.stream && this.producerTransport && this.device) {
                const track = mic.stream.getAudioTracks()[0];

                let appData: ProducerAppData = {
                    info: {
                        // mediaTag: 'mic',
                        stype: StreamType.Mic,
                        streamId: 'audio_stream',
                    }
                };

                console.log("produce mic ..."); 
                mic.producer = await this.producerTransport.produce({ track, appData });
                console.log("produce mic done"); 
                mic.serverMuted = false; // TODO: 赋值发布时的 mute
                console.log("produced mic", mic.producer);
            }

            if (mic.producer) {
                if (mic.producer.paused != muted) {
                    if (muted) {
                        console.log("pause mic producer");
                        mic.producer.pause();
                    } else {
                        mic.producer.resume();
                        console.log("resume mic producer");
                    }
                }

                if (muted != serverMuted && this.client && this.roomConfig) {
                    const producerId = mic.producer.id;
                    console.log("send request mic muted", muted, producerId); 
                    const rsp = await this.client.mute(this.roomConfig?.roomId, producerId, muted);
                    mic.serverMuted = muted;
                    console.log("recv response mic muted", muted, producerId, rsp);
                }
            }
        }
    }


    public async watchRemoteCamera(config: UserVideoConfig) {
        let cell = this.users.get(config.userId);
        if(!cell) {
            throw new Error(`Not found user ${config.userId}`);
        }

        if (!cell.video) {
            cell.video = {
                config,
            };
        } else {
            cell.video.config = config;
        }

        cell.video.view = config.view;

        if (cell.video.track) {
            // 已经订阅过了
            checkVideoSource(cell.video.track.consumer.track, cell.video.view);
            return;
        }

        this.tryWatchUserCamera(cell);
    }

    public async updateRemoteCamera(config: UserVideoConfig) {
        let cell = this.users.get(config.userId);
        if(!cell) {
            throw new Error(`Not found user ${config.userId}`);
        }

        if (!cell.video?.track) {
            return;
        }

        // TODO: 保存config，检查是否有改变view

        if (!this.client || !this.roomConfig) {
            return undefined;
        }

        await this.client.updateConsumeVideoLayer(this.roomConfig.roomId, cell.video.track.consumer.id, config.option?.small);

        return;
    }

    // TODO: 修改参数跟TRTC一致  
    public async unwatchRemoteCamera(userId: string) {
        let cell = this.users.get(userId);
        if(!cell) {
            return ;
        }

        if (!this.client || !this.roomConfig) {
            return ;
        }

        const consumerId = cell.video?.track?.consumer.id;
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

    public async startLocalShareScreen() {
        if (!this.client || !this.roomConfig) {
            return undefined;
        }

        if (!this.producerTransport || !this.device) {
            return;
        }

        if (this.screen.producer) {
            // 已经共享过
            return;
        }

        console.log("sharing screen");


        let screenStream;
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false    // 如需共享系统/麦克风声音，可设为 true，但兼容性略差
            });
        } catch (err: any) {
            if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
                // 用户取消，静默处理
                console.log('user cancel share screen');
                return;
            } else {
                // 其他异常，继续往外抛
                throw err;
            }
        }

        let appData: ProducerAppData = {
            info: {
                // mediaTag: 'screen',
                stype: StreamType.Screen,
                streamId: 'screen_stream',
            }
        };

        const track = screenStream.getVideoTracks()[0];
        
        // contentHint 的可能值：
        // motion: 优先流畅度（高帧率）。
        // detail: 优先清晰度（分辨率）。
        track.contentHint = 'detail';

        // 限制帧率和码率
        const encodings = [
            {maxFramerate: 5, maxBitrate: 1000000 },
        ];

        const producer = await this.producerTransport.produce({ 
            track,
            // codec,
            encodings,
            appData,
        });

        console.log("shared screen");

        track.onended = async () => {
            if (this.client && this.roomConfig) {
                const producerId = producer.id;
                const rsp = await this.client.unpublish(this.roomConfig.roomId, producerId);
                producer.close();
                this.screen.producer = undefined;
                this.screen.stream = undefined;
                console.log("unpublished screen producer", producerId, rsp);
            }
            console.log("share screen ended");
        };

        this.screen.producer = producer;
        this.screen.stream = screenStream;
        
        return;
    }

    public async watchUserScreen(config: UserVideoConfig) {
        let cell = this.users.get(config.userId);
        if(!cell) {
            throw new Error(`Not found user ${config.userId}`);
        }

        if (!cell.screen) {
            cell.screen = {
                config,
            };
        } else {
            cell.screen.config = config;
        }

        cell.screen.view = config.view;

        if (cell.screen.track) {
            // 已经订阅过了
            checkVideoSource(cell.screen.track.consumer.track, cell.screen.view);
            return;
        }

        this.tryWatchUserScreen(cell);
    }

    private async tryWatchUserCamera(cell: UserCell) {
        const found = Object.entries(cell.user.streams)
        .find(([_key, stream]) => stream.stype == StreamType.Camera);

        if(!found) {
            // throw new Error(`Not found video stream for user ${config.userId}`);
            return
        }

        if (!cell.video) {
            return;
        }

        if (!cell.video?.track) {
            const [streamId, videoStream] = found;
            const track = await this.subscribeStream(streamId, videoStream, cell.video.config.option?.small);
            if (!track) {
                return ;
            }
    
            // if (!cell.video) {
            //     cell.video = {};
            // }
    
            cell.video.track = track;

            const ok = checkVideoSource(cell.video.track.consumer.track, cell.video.view);
            console.log("checkVideoSource consumer id", track.consumer.id, ", user id", cell.user.id, ", ok", ok);

            if (cell.video.view) {
                cell.video.view.onloadedmetadata = () => console.log("metadata loaded, user id", cell.user.id);
                cell.video.view.oncanplay = () => console.log("can play, user id", cell.user.id);
            }

            if(cell.video.track.consumer.track) {
                console.log("dump video track", cell.video.track.consumer.track, ", user id", cell.user.id);
            }
        }
    }

    private async tryWatchUserScreen(cell: UserCell) {
        const found = Object.entries(cell.user.streams)
        .find(([_key, stream]) => stream.stype == StreamType.Screen);

        if(!found) {
            // throw new Error(`Not found video stream for user ${config.userId}`);
            return
        }

        if (!cell.screen) {
            return;
        }

        if (!cell.screen?.track) {
            const [streamId, videoStream] = found;
            const track = await this.subscribeStream(streamId, videoStream, cell.screen.config.option?.small);
            if (!track) {
                return ;
            }
    
            cell.screen.track = track;

            checkVideoSource(cell.screen.track.consumer.track, cell.screen.view);
        }
    }

    
    private async tryListenUserAudio(cell: UserCell) {
        // if(this.ignoreMe(cell.user.id)) {
        //     return;
        // }

        const found = Object.entries(cell.user.streams)
        .find(([_key, stream]) => stream.stype == StreamType.Mic);

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

            checkAudioSource(cell.audio.track.consumer.track, cell.audio.view);
        }
    }

    private async subscribeStream(streamId: string, stream: Stream, small?:boolean) : Promise<ConsumeTrack|undefined> {
        if (!this.client || !this.roomConfig || !this.consumerTransport) {
            return undefined;
        }

        console.log("subscribing stream", streamId, "small", small);
        const rsp = await this.client.subscribe(this.roomConfig.roomId, this.consumerTransport.id, streamId, stream.producer_id, small);
        console.log("subscribed", rsp);
    
        const consumer = await this.consumerTransport.consume({
            id: rsp.consumerId, 
            producerId: stream.producer_id, 
            kind: mediasoup_kind(stream.stype), 
            rtpParameters: rsp.rtp, 
            streamId,
        });
    
        console.log(`${consumer.kind} consumer created:`, consumer);

        return {
            streamId,
            producerId: stream.producer_id,
            consumer,
            // consumerId: rsp.consumerId,
            // media: consumer.track,
        };
    }

    private ignoreMe(userId: string): boolean {
        if(this.roomConfig) {
            if(!this.roomConfig.watchMe && this.roomConfig.userId === userId) {
                return true;
            }
        }
        return false;
    }

    private async updateUser(newUser: User): Promise<any> {

        if(this.ignoreMe(newUser.id)) {
            return;
        }


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
                    ext: newUser.ext,
                },
            };
            
            this.users.set(newUser.id, cell);

            this.trigger(VVRTC.EVENT.USER_JOIN, {
                userId: newUser.id,
                userExt: newUser.ext,
            });

        } 

        this.checkUserEvent(cell, newUser);
    }

    private async checkUserEvent(cell: UserCell, newUser: User) {

        const oldUser = cell.user;

        if(!newUser.online) {

            this.users.delete(newUser.id);

            this.cleanUser(cell);

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

                if (stream.stype == StreamType.Camera) {
                    let video = cell.video;
                    if (video) {
                        if (video.track?.producerId == stream.producer_id) {
                            console.log("remove video track, producer_id", stream.producer_id);
                            video.track = undefined;

                            if (video.view) {
                                video.view.srcObject = null;
                            }
                        }
                    }

                    this.trigger(VVRTC.EVENT.USER_CAMERA_OFF, {
                        userId: newUser.id,
                    });
                } else if (stream.stype == StreamType.Mic) {
                    if (cell.audio) {
                        if (cell.audio.track?.producerId == stream.producer_id) {
                            console.log("remove audio track, producer_id", stream.producer_id);
                            cell.audio.track = undefined;

                            if (cell.audio.view) {
                                cell.audio.view.srcObject = null;
                            }
                        }
                    }
                } else if (stream.stype == StreamType.Screen) {
                    let video = cell.screen;
                    if (video) {
                        if (video.track?.producerId == stream.producer_id) {
                            console.log("remove video track, producer_id", stream.producer_id);
                            video.track = undefined;

                            if (video.view) {
                                video.view.srcObject = null;
                            }
                        }
                    }

                    this.trigger(VVRTC.EVENT.USER_SCREEN_OFF, {
                        userId: newUser.id,
                    });
                }

            }
        });

        Object.keys(newUser.streams).forEach(streamId => {

            const newStream = newUser.streams[streamId];

            if (!oldUser.streams.hasOwnProperty(streamId)) {
                
                // 触发添加事件
                console.log("add stream, user", newUser.id, newStream);
                if (newStream.stype == StreamType.Camera) {
                    this.trigger(VVRTC.EVENT.USER_CAMERA_ON, {
                        userId: newUser.id,
                    });
                } else if (newStream.stype == StreamType.Mic) {
                    if (!newStream.muted) {
                        this.trigger(VVRTC.EVENT.USER_MIC_ON, {
                            userId: newUser.id,
                        });
                    }
                    this.tryListenUserAudio(cell);
                } else if (newStream.stype == StreamType.Screen) {
                    this.trigger(VVRTC.EVENT.USER_SCREEN_ON, {
                        userId: newUser.id,
                    });
                } else {
                    console.warn("unknown stream media kind", newStream);
                }

            } else {

                const oldStream = oldUser.streams[streamId];
                if (oldStream.muted != newStream.muted) {
                    if (newStream.stype == StreamType.Mic) {
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
        this.checkCamera("checkPublish");
        this.checkMic("checkPublish");
    }

    private async checkSubscribe() {
        this.users.forEach( (cell, _userId) => {
            this.tryWatchUserCamera(cell);
            this.tryWatchUserScreen(cell);
            this.tryListenUserAudio(cell);
        });
    }

    on<T extends keyof VVRTCEventTypes>(event: T, handler: (...args: VVRTCEventTypes[T]) => void): this {
        this.emitter.on(event, handler);
        return this;
    }

    trigger<T extends keyof VVRTCEventTypes>(
        event: T,
        ...args: VVRTCEventTypes[T]
    ) {
        this.emitter.emit(event, ...args);
    }

    // // 添加监听器
    // on<T>(event: string, listener: Listener<T>): void {
    //     this.emitter.on(event, listener);
    // }

    // // 移除监听器
    // off<T>(event: string, listener: Listener<T>): void {
    //     this.emitter.off(event, listener);
    // }

    // // 触发事件
    // private trigger<T>(event: string, data: T): Boolean {
    //     return this.emitter.emit(event, data);
    // }
}

// function mediasoup_kind(kind: number): 'audio' | 'video' {
// 	return kind == MKind.Audio ? "audio" : "video"
// }

function mediasoup_kind(stype: number): 'audio' | 'video' {
	// return kind == MKind.Audio ? "audio" : "video"
    switch (stype) {
        case StreamType.Mic:
            return "audio";
        case StreamType.Camera:
            return "video";
        case StreamType.Screen:
            return "video";
        default:
            throw new Error(`Unknown stream type ${stype}`);
    }
}



function checkVideoSource(media?: MediaStreamTrack, view?: HTMLVideoElement): Boolean {
    
    if (media && view) {
        const combinedStream = new MediaStream();
        combinedStream.addTrack(media);
        view.srcObject = combinedStream;
        view.autoplay = true;
        view.playsInline = true;
        // console.log("assign video source", media);
        return true;
    } 
    return false;
}

function checkAudioSource(media?: MediaStreamTrack, view?: HTMLAudioElement): Boolean {
    
    if (media && view) {
        const combinedStream = new MediaStream();
        combinedStream.addTrack(media);
        view.srcObject = combinedStream;
        // console.log("assign audio source", media);

        view.play().catch((error) => {
            console.error('play audio failed:', error);
        });
        
        return true;
    } 
    return false;
}


