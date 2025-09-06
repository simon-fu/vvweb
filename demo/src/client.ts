import { DtlsParameters } from 'mediasoup-client/lib/Transport';
import { RtpParameters } from 'mediasoup-client/lib/RtpParameters';
import { EventEmitter, Listener } from "./emitter";

// type Result<T, E> = { type: 'ok', value: T } | { type: 'err', error: E };


export interface Stream {
	seq: number;
	// kind: number;  // 1-audio, 2-video
    stype: number;
	producer_id: string; 
    muted: boolean;
}


export interface User {
	id: string;
	online: boolean;
	streams: { [key: string]: Stream };
    ext?: string;
    inst_id?: string;
    // streams: Map<string, Stream>;
}


export interface Notice {
    room_id: string,
    seq: number,
    body: any,
}

export interface Status {
    code: number,
    reason: string,
}

export interface RequiredOptions {
    url: string,
    userId: string,
    roomId: string, 
}

export interface OptionalOptions {
    maxReconnInterval?: number, // in milliseconds
    maxReconnectTimeout?: number,
    connectTimeout?: number,
    userExt?: string,
}

export type ClientOptions = RequiredOptions & OptionalOptions;

const defaultOptions: Required<Pick<OptionalOptions, "maxReconnInterval" | "maxReconnectTimeout" | "connectTimeout">> = {
    maxReconnInterval: 1000,
    maxReconnectTimeout: 5000,
    connectTimeout: 3000,
};



export class Client {
    private ws?: WebSocket;

    private emitter: EventEmitter;

    private pendingRequests: Map< number, { 
        origin: string;
        resolve: (value: any) => void; 
        reject: (reason?: any) => void;
    }>;
    private msgIdCounter: number;
    private sessionId?: string;
    


    private opts: ClientOptions;
    private closed: boolean = false;

    private reconnStartTime: number = 0; // 第一次重连开始时间

    private roomCursors: Record<string, number> = {};
    // const roomCursors: { [roomId: string]: number } = {}; // 等价于 Record<string, number>

    constructor(options: ClientOptions) {
        // this.ws = typeof wsOrUrl === "string" ? new WebSocket(wsOrUrl) : wsOrUrl;

        this.pendingRequests = new Map();
        this.msgIdCounter = 1;
        this.emitter = new EventEmitter();

        this.opts = { ...defaultOptions, ...options };

        this.tryKickConnect(false);
    }

    private handleMessage(event: MessageEvent) {
        
        console.log("got msg", event.data);

        const msg = JSON.parse(event.data);

        if (msg.msg_type.Response) {

            // {"msg_type":{"Response":{"status":null,"msg_id":1,"response_type":{"OpenSessionResponse":{}}}}}

            const { msg_id } = msg.msg_type.Response;
        
            const pending = this.pendingRequests.get(msg_id);
            if (!pending) {
                console.warn("Not found request", msg.msg_type.Response);
                return;
            }
            
            this.pendingRequests.delete(msg_id);

            const status = msg.msg_type.Response.status;

            if (status == null || status.code === 0) {
                pending.resolve(msg.msg_type.Response.response_type);
            } else {
                console.error("response status:", status);
                pending.reject(new Error(status))
            }

        } else {

            if (msg.msg_type.Notice) {
                const notice = msg.msg_type.Notice;
                const body = JSON.parse(notice.json);
                delete notice.json;
                notice.body = body;
                this.roomCursors[notice.room_id] = notice.seq;
                const handled = this.trigger("notice", notice);
                if (handled) {
                    return;
                }
            } else if (msg.msg_type.ClosedNotice) {
                const ev = msg.msg_type.ClosedNotice;
                if(ev.status) {
                    ev.status.from = "server";
                }
                // const handled = this.trigger("closed", ev);
                const handled = this.triggerClosed(ev.status.code, ev.status.reason, ev.status.from);
                if (handled) {
                    return;
                }
            }

            console.warn("Unhandle msg", msg);
        }
    }

    private handleError(event: Event) {
        console.error("WebSocket error", event);

        for (const [, { reject }] of this.pendingRequests) {
            reject(new Error("WebSocket error"));
        }
        this.pendingRequests.clear();
    }

    private handleClose(event: CloseEvent) {
        console.log("WebSocket closed", event);

        for (const [, { reject, origin }] of this.pendingRequests) {
            console.log("reject request, origin", origin);
            reject(new Error("WebSocket closed [" + origin + "]"));
        }
        this.pendingRequests.clear();

        this.trigger("disconnect", {event});

        this.tryKickConnect(true);
    }

    private cleanUp() {
        if(this.ws) {
            this.ws.onmessage = null;
            this.ws.onerror = null;
            this.ws.onclose = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = undefined;
        }

        this.sessionId = undefined;
        this.closed = true;
        // this.url = undefined;
    }

    private tryKickConnect(reconn: boolean) {
        const url = this.opts.url;
        const delay = reconn ? this.opts.maxReconnInterval : 0;
        setTimeout(async () => {

            if(!this.closed) {
                this.doKickConnect(url);
            }
        }, delay);
    }

    private triggerClosed(code: number, reason: string, from: string) : boolean {
        this.reconnStartTime = 0;
        const handled = this.trigger("closed", {status: {code, reason, from}});
        this.cleanUp();
        return handled;
    }

    private doKickConnect(url: string) {

        if(this.reconnStartTime > 0) {
            const timeout = this.opts.maxReconnectTimeout||0;
            if((Date.now() - this.reconnStartTime) > timeout) {
                // console.warn("reconnect timeout");
                // this.trigger("reconnect-fail", {});
                this.triggerClosed(111, "reconnect timeout", "local");
                return;
            }
        } else {
            this.reconnStartTime = Date.now();
        }

        console.log("start connecting to ", url);
        this.ws = undefined;
        const ws = new WebSocket(url);

        const flag = {
            handled: false,
        };

        const timeoutHandle = setTimeout(async () => {
            if(!flag.handled) {
                console.warn("connection timeout");
                flag.handled = true;
                ws.close();
                this.handleConnectFailed();
            } 
            
        }, this.opts.connectTimeout);


        ws.onopen = (event: Event) => {
            if(this.closed || flag.handled) {
                return;
            }

            flag.handled = true;
            clearTimeout(timeoutHandle);

            console.log("WebSocket opened", url, event);
            this.ws = ws;
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            // this.ws.onopen = this.handleOpen.bind(this);

            this.reconnStartTime = 0; // TODO: 应该在 Reconnect Request 收到响应时候在置 0
            this.trigger("connected", {event});

            setTimeout(async () => {
                if(this.closed) {
                    return;
                }

                if(!this.sessionId) {
                    await this.open_session();
                } else {
                    await this.reconn_session(this.sessionId);
                }
                
            }, 0);

        };

        ws.onerror = (event: Event) => {
            if(!flag.handled) {
                console.error("connect failed", event);
                flag.handled = true;
                this.handleConnectFailed();
            }
        };
    }

    private handleConnectFailed() {
        this.trigger("connect-error", {});
        this.tryKickConnect(true);
    }

    public async invoke(req: any, origin: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if(!this.ws) {
                reject(new Error("no connection"));
                return;
            }

            const msg_id = this.msgIdCounter++;
            req.msg_id = msg_id;
            
            this.pendingRequests.set(msg_id, { resolve, reject, origin });
            this.ws.send(JSON.stringify(req));
        });
    }

    // public async try_invoke(req: any): Promise<Result<any, Error>> {
    //     try {
    //         const response = await this.invoke(req);
    //         return { type: 'ok', value: response };
    //     } catch (error) {
    //         return { type: 'err', error: error instanceof Error ? error : new Error(String(error)) };
    //     }
    // }

    // 添加监听器
    public on<T>(event: string, listener: Listener<T>): void {
        this.emitter.on(event, listener);
    }

    // 移除监听器
    public off<T>(event: string, listener: Listener<T>): void {
        this.emitter.off(event, listener);
    }

    // 触发事件
    private trigger<T>(event: string, data: T): boolean {
        return this.emitter.emit(event, data);
    }

    private async open_session() {
        try {
            const rsp = await this.req_open_session();
            console.log("open session response", rsp);

            if(this.closed) {
                return;
            }

            const status = rsp.status ?? {code: 0, reason: ""};
            if (status.code == 0) {
                this.sessionId = rsp.session_id;
                this.roomCursors[this.opts.roomId] = 0;
                this.trigger("opened", {
                    sessionId: this.sessionId,
                });
            } else {
                this.triggerClosed(status.code, status.reason, "server");
            }
        } catch(err) {
            console.log("do_open_session error", err);
        }
    }

    private async req_open_session(): Promise<any> {
        const roomId = this.opts.roomId;

        const rsp = await this.invoke({
            // msg_id: next_msg_id(),
            typ: {
                Open: {
                    user_id: this.opts.userId,
                    room_id: roomId,
                    user_ext: this.opts.userExt,
                },
            }
        }, "req_open_session");

        // const status = rsp.Open.status ?? {code: 0, reason: ""};
        // if (status.code == 0) {
        //     this.sessionId = rsp.Open.session_id;
        //     this.roomCursors[roomId] = 0;
        // } else {

        // }

        return rsp.Open;
    }

    async reconn_session(sessionId: string): Promise<any> {
        const room_cursors = Object.entries(this.roomCursors).map(([room_id, seq]) => ({
            room_id,
            seq
        }));

        const rsp = await this.invoke({
            typ: {
                Reconn: {
                    session_id: sessionId,
                    room_cursors,
                    try_seq: 0,
                    last_success_seq: 0,
                    magic: 20250901,
                },
            }
        }, "reconn_session");

        console.log("reconn_session:", rsp.Reconn);

        const status = rsp.Reconn.status ?? {code: 0, reason: ""};
        if (status.code == 0) {
            this.trigger("reconn-session", {
                conn_id: rsp.Reconn.conn_id,
            });
        } else {
            this.triggerClosed(status.code, status.reason, "server");
        }

        return rsp.Reconn;
    }

    public async close_session(room_id: string): Promise<void> {
        // console.log("close session ...");
        try {
            const rsp = await this.invoke({
                typ: {
                    Close: {
                        room_id,
                    },
                }
            }, "close_session");
            console.log("closed session response", rsp);  
            
            this.cleanUp();

            // return rsp.Close;
        } catch (err) {
            console.log("close_session error", err);
            this.cleanUp();
        }
    }

    public async end_room(room_id: string): Promise<any> {
        // console.log("close session ...");
        const rsp = await this.invoke({
            typ: {
                End: {
                    room_id,
                },
            }
        }, "end_room");

        this.cleanUp();

        return rsp.End;
    }

    public async create_producer_transport(roomId: string): Promise<any> {
        const rsp = await this.invoke({
            typ: {
                CreateX: {
                    roomId,
                    dir: 0,     // Inbound = 0, Outbound = 1
                    kind: 0,    // AudioVideo = 0, Audio = 1, Video = 2,
                },
            }
        }, "create_producer_transport");
        return rsp.CreateX;
    }

    public async create_consumer_transport(roomId: string): Promise<any> {
        const rsp = await this.invoke({
            typ: {
                CreateX: {
                    roomId,
                    dir: 1,     // Inbound = 0, Outbound = 1
                    kind: 0,    // AudioVideo = 0, Audio = 1, Video = 2,
                },
            }
        }, "create_consumer_transport");
        return rsp.CreateX;
    }

    public async connect_transport(_roomId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<any> {
        const rsp = await this.invoke({
            typ: {
                ConnX: {
                    xid: transportId,
                    dtls: dtlsParameters,
                    // dtls: {
                    //     role: 0, // Client = 0,
                    //     fingerprints: dtlsParameters.fingerprints,
                    // }
                },
            }
        }, "connect_transport");
        return rsp.ConnX;
    }

    public async publish(roomId: string, transportId: string, streamId: string, stype: number, rtpParametersTyped: RtpParameters, muted?: boolean): Promise<any> {
        // const codecs = rtpParametersTyped.codecs;
        // const encodings = rtpParametersTyped.encodings;
        // const rtpParameters: any = rtpParametersTyped;

        // rtpParameters.headerExtensions = rtpParameters.headerExtensions ? JSON.stringify(rtpParameters.headerExtensions) : "[]";

        // rtpParameters.rtcp = rtpParameters.rtcp ? JSON.stringify(rtpParameters.rtcp) : "";

        // rtpParameters.codecs = [];
        // for (const item of codecs) {
        //     rtpParameters.codecs.push({
        //         mimeType: item.mimeType ? item.mimeType : "",
        //         payloadType: item.payloadType ? item.payloadType : 0,
        //         channels: item.channels ? item.channels: 0,
        //         clockRate: item.clockRate ? item.clockRate : 0,
        //         parameters: item.parameters ? JSON.stringify(item.parameters) : "{}",
        //         rtcpFeedback: item.rtcpFeedback ? JSON.stringify(item.rtcpFeedback) : "[]",
        //     });
        // }
        
        // rtpParameters.encodings = [];
        // if (encodings) {
        //     for (const item of encodings) {
        //         rtpParameters.encodings.push({
        //             ssrc: item.ssrc ? item.ssrc : 0,
        //             rtxSsrc: item.rtx? item.rtx.ssrc : 0,
        //             rid: item.rid ? item.rid : "",
        //             payloadType: item.codecPayloadType ? item.codecPayloadType : 0,
        //             dtx: item.dtx ? item.dtx : false,
        //             scalabilityMode: item.scalabilityMode ? item.scalabilityMode : "",
        //             scaleResolutionDownBy: item.scaleResolutionDownBy ? item.scaleResolutionDownBy : 0,
        //             fecSsrc: 0,
        //         })
        //     }
        // }


        const rsp = await this.invoke({
            typ: {
                Pub: {
                    roomId, 
                    xid: transportId,
                    streamId,
                    // kind: MEDIA_KIND_MAP[kind],
                    stype,
                    // rtpParameters,
                    audioType: 0, // RoutableAudio = 0, ExclusiveAudio = 1, PriorityRoomAudio = 2,
                    rtp: rtpParametersTyped,
                    muted,
                },
            }
        }, "publish");
        return rsp.Pub;

    }

    public async unpublish(roomId: string, producerId: string): Promise<any> {
        await this.invoke({
            typ: {
                UPub: {
                    roomId, 
                    producerId,
                },
            }
        }, "unpublish");
        return {};
    }

    public async mute(roomId: string, producerId: string, muted: boolean): Promise<any> {
        await this.invoke({
            typ: {
                Mute: {
                    roomId, 
                    producerId,
                    muted,
                },
            }
        }, "mute");
        return {};
    }

    public async subscribe(roomId: string, transportId: string, streamId: string, producerId: string, small?:boolean): Promise<any> {
        const rsp = await this.invoke({
            typ: {
                Sub: {
                    roomId, 
                    xid: transportId,
                    streamId,
                    producerId,
                    preferredLayers: small ? {
                        spatialLayer: 0,
                        temporalLayer: 2,
                    } : null,
                },
            }
        }, "subscribe");

        return rsp.Sub;
    }

    public async unsubscribe(roomId: string, consumerId: string): Promise<any> {
        const rsp = await this.invoke({
            typ: {
                USub: {
                    roomId, 
                    consumerId,
                },
            }
        }, "unsubscribe");

        return rsp.USub;
    }

    public async updateConsumeVideoLayer(roomId: string, consumerId: string, small?: boolean) : Promise<any>  {
        const rsp = await this.invoke({
            typ: {
                Layer: {
                    roomId, 
                    consumerId,
                    preferredLayers: small ? {
                        spatialLayer: 0,
                        temporalLayer: 2,
                    } : null,
                },
            }
        }, "updateConsumeVideoLayer");

        return rsp.Layer;
    }

    public async updateUserExt(ext?: string) : Promise<any> {
        const rsp = await this.invoke({
            typ: {
                UpExt: {
                    ext, 
                },
            }
        }, "updateUserExt");

        return rsp.UpExt;
    }
}

