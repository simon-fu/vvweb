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
    heartbeatInterval?: number,
    heartbeatTimeout?: number,
    userExt?: string,
    userTree?: {
        path: string,
        value?: string,
        prune?: boolean, 
    }[],
}

export type ClientOptions = RequiredOptions & OptionalOptions;

const defaultOptions: Required<Pick<OptionalOptions, "maxReconnInterval" | "maxReconnectTimeout" | "connectTimeout" | "heartbeatInterval" | "heartbeatTimeout">> = {
    maxReconnInterval: 1000,
    maxReconnectTimeout: 5000,
    connectTimeout: 3000,
    heartbeatInterval: 15000,
    heartbeatTimeout: 10000,
};

class StatusError extends Error {
    constructor(public status: { code: number; reason: string }) {
        super(`status code: ${status.code}, reason: ${status.reason ?? ""}`);
        this.name = "StatusError";
    }
}

export class Client {
    private ws?: WebSocket;

    private emitter: EventEmitter;

    private pendingRequests: Map< number, { 
        origin: string;
        resolve: (value: any) => void; 
        reject: (reason?: any) => void;
    }>;
    
    private inflights: {
        sn: number,
        packet: string,
    }[] = [];
    private headIndex: number = 0;
    // private sendIndex: number = 0;

    private msgIdCounter: number = 0;
    private sessionId?: string;
    // private ackSeq: number = 0;
    private recvSn: number = 0;
    private sentAckSn: number = 0;
    
    private pendingFirst? : {
        origin: string;
        resolve: (value: any) => void; 
        reject: (reason?: any) => void;
    };


    private opts: ClientOptions;
    private closed: boolean = false;

    private reconnStartTime: number = 0; // 第一次重连开始时间
    private heartbeatTimer?: ReturnType<typeof setInterval>;
    private heartbeatAckTimer?: ReturnType<typeof setTimeout>;
    private heartbeatWaitingAck: boolean = false;

    // private roomCursors: Record<string, number> = {};
    // const roomCursors: { [roomId: string]: number } = {}; // 等价于 Record<string, number>

    constructor(options: ClientOptions) {
        // this.ws = typeof wsOrUrl === "string" ? new WebSocket(wsOrUrl) : wsOrUrl;

        this.pendingRequests = new Map();
        // this.msgIdCounter = 1;
        this.emitter = new EventEmitter();

        this.opts = { ...defaultOptions, ...options };

        this.tryKickConnect(false);
    }

    private handleMessage(event: MessageEvent) {
        
        console.log("xfer recv", event.data);

        const packet = JSON.parse(event.data);

        const parsedBody = JSON.parse(packet.body);
        if (packet.ack) {
            this.ackInflights(packet.ack);
        }

        
        if (this.pendingFirst) {
            const callback = this.pendingFirst;
            this.pendingFirst = undefined;
            callback.resolve(parsedBody.typ);

            // const msg_id:number = packet.ack;
            // if (reconn.sn === msg_id) {
            //     reconn.resolve(parsedBody.typ);
            // } else {
            //     reconn.reject(new Error(`expect reconn ack ${reconn.sn} but ${msg_id}`));
            // }

            return;
        }

        // 放在 pendingFirst 是为了忽略第一个 resposne sn
        if (packet.sn) {
            const sn: number = packet.sn;
            if (sn > this.recvSn) {
                this.recvSn = sn;

                const ack = this.getSendAck();
                if (ack && this.ws) {
                    this.sendData(this.ws, JSON.stringify({
                        ack,
                    }));
                }
            } 
        }

        if (packet.typ === PacketType.Response) {
        // if (msg.msg_type.Response) {

            // // {"msg_type":{"Response":{"status":null,"msg_id":1,"typ":{"OpenSessionResponse":{}}}}}

            // const response = msg.msg_type.Response;
            // const msg_id = response.msg_id;
            // // const { msg_id } = msg.msg_type.Response;

            const response = parsedBody;

            if (response?.typ?.HB) {
                this.onHeartbeatAck();
                return;
            }

            const msg_id:number = packet.ack;
        
            const pending = this.pendingRequests.get(msg_id);
            if (!pending) {
                console.warn("Not found request", response);
                return;
            }
            
            this.pendingRequests.delete(msg_id);
            

            const status = response.status;

            if (!status || status.code === 0) {
                pending.resolve(response.typ);
            } else {
                console.error("response status:", status);
                pending.reject(new StatusError(status))
            }

        } else if (packet.typ === PacketType.Push0 || packet.typ === PacketType.Push1 || packet.typ === PacketType.Push2) {
            // const push = JSON.parse(packet.body);
            const pushType = parsedBody.typ;

            if (pushType.Notice) {
                // const notice = msg.msg_type.Notice;
                // const body = JSON.parse(notice.json);
                // delete notice.json;
                // notice.body = body;
                // this.roomCursors[notice.room_id] = notice.seq;
                // console.log("recv notice", notice);
                // const handled = this.trigger("notice", notice);
                // if (handled) {
                //     return;
                // }
            } else if (pushType.Closed) {
                const ev = pushType.Closed;
                if(ev.status) {
                    ev.status.from = "server";
                }
                // const handled = this.trigger("closed", ev);
                const handled = this.triggerClosed(ev.status.code, ev.status.reason, ev.status.from);
                if (handled) {
                    return;
                }
            } else if (pushType.UReady) {
                const body = pushType.UReady;
                const handled = this.trigger("ready-notice", {
                    User: body,
                });
                if (handled) {
                    return;
                }
            } else if (pushType.RReady) {
                const body = pushType.RReady;
                const handled = this.trigger("ready-notice", {
                    Room: body,
                });
                if (handled) {
                    return;
                }
            } else if (pushType.UInit) {
                const body = pushType.UInit;
                const handled = this.trigger("user-init", body);
                if (handled) {
                    return;
                }
            } else if (pushType.UFull) {
                const body = pushType.UFull;
                const handled = this.trigger("notice", {
                    room_id: this.opts.roomId,
                    seq: packet.sn,
                    body: {User: body},
                });
                if (handled) {
                    return;
                }
            } else if (pushType.UTree) {
                const body = pushType.UTree;
                const handled = this.trigger("notice", {
                    room_id: this.opts.roomId,
                    seq: packet.sn,
                    body: {UTree: body},
                });
                if (handled) {
                    return;
                }
            } else if (pushType.RTree) {
                const body = pushType.RTree;
                const handled = this.trigger("notice", {
                    room_id: this.opts.roomId,
                    seq: packet.sn,
                    body: {RTree: body},
                });
                if (handled) {
                    return;
                }
            } else if (pushType.Chat) {
                const body = pushType.Chat;
                const handled = this.trigger("chat", body);
                if (handled) {
                    return;
                }
            }
            
            // else if (msg.msg_type.Ch) {
            //     const ev = msg.msg_type.Ch;
            //     const handled = this.trigger("ch-notice", ev);
            //     if (handled) {
            //         return;
            //     }
            // } else if (msg.msg_type.P1) {
            //     const ev = msg.msg_type.P1;
            //     const handled = this.handlePush(ev);

            //     this.ws?.send(JSON.stringify({
            //         msg_id: this.nextMsgId(),
            //         typ: {
            //             Ack: {
            //                 seq: this.ackSeq,
            //             },
            //         }
            //     }));

            //     if (handled) {
            //         return;
            //     }
            // }

            console.warn("Unhandle packet", packet);
        }
    }

    // private handlePush(ev: any) : boolean {
    //     const body = JSON.parse(ev.body);
    //     this.ackSeq = ev.seq;

    //     enum BodyType {
    //         UserInit = 1,
    //         UserState = 2,
    //         UserTree = 3,
    //         UserReady = 4,
    //         RoomTree = 5,
    //         RoomReady = 6,
    //         Chat = 7,
    //     }

    //     if (ev.btype === BodyType.UserInit) {
    //         return this.trigger("user-init", body);
    //     } else if (ev.btype === BodyType.UserState) {
    //         return this.trigger("notice", {
    //             room_id: this.opts.roomId,
    //             seq: ev.seq,
    //             body: {User: body},
    //         });
    //     } else if (ev.btype === BodyType.UserTree) {
    //         return this.trigger("notice", {
    //             room_id: this.opts.roomId,
    //             seq: ev.seq,
    //             body: {UTree: body},
    //         });
    //     } else if (ev.btype == BodyType.RoomTree) {
    //         return this.trigger("notice", {
    //             room_id: this.opts.roomId,
    //             seq: ev.seq,
    //             body: {RTree: body},
    //         });
    //     } else if (ev.btype === BodyType.RoomReady) {
    //         return this.trigger("ready-notice", {
    //             Room: body,
    //         });
    //     } else if (ev.btype === BodyType.UserReady) {
    //         return this.trigger("ready-notice", {
    //             User: body,
    //         });
    //     } else if (ev.btype === BodyType.Chat) {
    //         return this.trigger("chat", body);
    //     } else {
    //         return false;
    //     }
    // }

    private nextMsgId(): number {
        this.msgIdCounter += 1;
        return this.msgIdCounter;
    }

    private handleError(event: Event) {
        console.error("WebSocket error", event);

        // this.rejectPendings();
    }

    private handleClose(event: CloseEvent) {
        console.warn("WebSocket closed", event);
        this.stopHeartbeat();

        // this.rejectPendings();

        this.trigger("disconnect", {event});

        this.tryKickConnect(true);
    }

    private rejectPendings() {
        for (const [, { reject, origin }] of this.pendingRequests) {
            console.log("reject request, origin", origin);
            reject(new Error("WebSocket closed [" + origin + "]"));
        }
        this.pendingRequests.clear();
    }

    private ackInflights(ack: number) {
        while (this.headIndex < this.inflights.length) {
            if (this.inflights[this.headIndex].sn <= ack) {
                this.headIndex += 1;
            } else {
                break;
            }
        }

        if (this.headIndex >= this.inflights.length) {
            this.clearInflights();
        }
    }

    private resendInflights(ws: WebSocket) {
        let index = this.headIndex;
        while (index < this.inflights.length) {
            this.sendData(ws, this.inflights[index].packet);
            index += 1;
        }
    }

    private clearInflights() {
        this.inflights = [];
        this.headIndex = 0;
    }


    private sendData(ws: WebSocket, json: string) {
        console.debug("xfer send", json);
        ws.send(json);
    }



    private cleanUp() {
        this.stopHeartbeat();

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

        this.clearInflights();
        this.rejectPendings();
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

            // this.reconnStartTime = 0; // TODO: 应该在 Reconnect Request 收到响应时候再置 0
            this.trigger("connected", {event});

            setTimeout(async () => {
                if(this.closed) {
                    return;
                }

                try {
                    if(!this.sessionId) {
                        await this.open_session(ws);
                    } else {
                        await this.reconn_session(ws, this.sessionId);
                    }
                    this.reconnStartTime = 0;
                } catch (err) {

                    ws.close();

                    if (err instanceof StatusError) {
                        console.error("connect status:", err.status);
                        this.triggerClosed(err.status.code, err.status.reason, "server");
                    } else {
                        console.log("connect error", err);
                    }
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

    private startHeartbeat() {
        this.stopHeartbeat();
        const interval = this.opts.heartbeatInterval || 0;
        if (interval <= 0) {
            return;
        }

        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, interval);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
        if (this.heartbeatAckTimer) {
            clearTimeout(this.heartbeatAckTimer);
            this.heartbeatAckTimer = undefined;
        }
        this.heartbeatWaitingAck = false;
    }

    private sendHeartbeat() {
        const ws = this.ws;
        if (this.closed || !ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }

        if (this.heartbeatWaitingAck) {
            return;
        }

        this.heartbeatWaitingAck = true;
        const msg_id = this.nextMsgId();
        this.sendRequest(ws, msg_id, {
            typ: {
                HB: {},
            },
        });

        const timeout = this.opts.heartbeatTimeout || 0;
        if (timeout > 0) {
            this.heartbeatAckTimer = setTimeout(() => {
                if (!this.heartbeatWaitingAck) {
                    return;
                }

                if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
                    console.warn("heartbeat timeout, close socket");
                    ws.close();
                }
            }, timeout);
        }
    }

    private onHeartbeatAck() {
        this.heartbeatWaitingAck = false;
        if (this.heartbeatAckTimer) {
            clearTimeout(this.heartbeatAckTimer);
            this.heartbeatAckTimer = undefined;
        }
    }

    private getSendAck(): number|undefined {
        if (this.sentAckSn < this.recvSn) {
            this.sentAckSn = this.recvSn;
            return this.recvSn;
        } else {
            return undefined
        }
    }

    public async invoke(req: any, origin: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if(!this.ws) {
                reject(new Error("no connection"));
                return;
            }

            // const msg_id = this.msgIdCounter++;
            // // req.msg_id = msg_id;

            // const packet = {
            //     sn: msg_id, 
            //     typ: PacketType.Request,
            //     body: JSON.stringify(req),
            //     ack: this.getSendAck(),
            // };
            
            // const json = JSON.stringify(packet)

            // // this.ws.send(json);
            // this.sendJson(this.ws, json);

            const msg_id = this.nextMsgId(); // this.msgIdCounter++;
            const json = this.sendRequest(this.ws, msg_id, req);

            this.pendingRequests.set(msg_id, { resolve, reject, origin });
            this.inflights.push({
                sn: msg_id,
                packet: json,
            });
        });
    }

    private sendRequest(ws: WebSocket, sn: number|undefined, req: any): string {

        // const msg_id = this.msgIdCounter++;
        // req.msg_id = msg_id;

        const packet = {
            sn, 
            typ: PacketType.Request,
            body: JSON.stringify(req),
            ack: this.getSendAck(),
        };
        
        const json = JSON.stringify(packet)

        // ws.send(json);
        this.sendData(ws, json);

        return json;
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

    private async open_session(ws: WebSocket,) {
        try {
            const rsp = await this.req_open_session(ws);
            console.log("open session response", rsp);

            if(this.closed) {
                return;
            }

            const status = rsp.status ?? {code: 0, reason: ""};
            if (status.code === 0) {
                this.sessionId = rsp.session_id;
                // this.roomCursors[this.opts.roomId] = 0;
                this.trigger("opened", {
                    sessionId: this.sessionId,
                });
                this.startHeartbeat();
            } else {
                // 应该走不到这里，错误会抛异常
                this.triggerClosed(status.code, status.reason, "server");
            }
        } catch(err) {
            // console.log("do_open_session error", err);
            if (err instanceof StatusError) {
                console.error("open session response status:", err.status);
                this.triggerClosed(err.status.code, err.status.reason, "server");
            } else {
                console.log("connect error", err);
            }
        }
    }

    private async req_open_session(ws: WebSocket,): Promise<any> {
        // const roomId = this.opts.roomId;

        // const rsp = await this.invoke({
        //     // msg_id: next_msg_id(),
        //     typ: {
        //         Open: {
        //             user_id: this.opts.userId,
        //             room_id: roomId,
        //             user_ext: this.opts.userExt,
        //             user_tree: this.opts.userTree,
        //         },
        //     }
        // }, "req_open_session");

        // return rsp.Open;



        const roomId = this.opts.roomId;

        this.sentAckSn = 0;

        this.sendRequest(ws, undefined, {
            typ: {
                Open: {
                    user_id: this.opts.userId,
                    room_id: roomId,
                    user_ext: this.opts.userExt,
                    user_tree: this.opts.userTree,
                },
            }
        });

        const promise: Promise<any> = new Promise((resolve, reject) => {
            this.pendingFirst = {
                origin: "req_open_session",
                resolve, 
                reject,
            };
        });

        const rsp = await promise;

        return rsp.Open;
    }

    async reconn_session(ws: WebSocket, sessionId: string): Promise<any> {
        // const room_cursors = Object.entries(this.roomCursors).map(([room_id, seq]) => ({
        //     room_id,
        //     seq
        // }));

        // const rsp = await this.invoke({
        //     typ: {
        //         Reconn: {
        //             session_id: sessionId,
        //             // room_cursors,
        //             try_seq: 0,
        //             last_success_seq: 0,
        //             magic: 20250901,
        //         },
        //     }
        // }, "reconn_session");

        this.sentAckSn = 0;

        this.sendRequest(ws, undefined, {
            typ: {
                Reconn: {
                    session_id: sessionId,
                    // room_cursors,
                    try_seq: 0,
                    last_success_seq: 0,
                    magic: 20250901,
                },
            }
        });

        const promise: Promise<any> = new Promise((resolve, reject) => {
            this.pendingFirst = {
                origin: "reconn_session",
                resolve, 
                reject,
            };
        });

        const rsp = await promise;

        console.log("reconn_session:", rsp.Reconn);

        const status = rsp.Reconn.status ?? {code: 0, reason: ""};
        if (status.code == 0) {
            
            this.resendInflights(ws);

            this.trigger("reconn-session", {
                conn_id: rsp.Reconn.conn_id,
            });
            this.startHeartbeat();
        } else {
            this.triggerClosed(status.code, status.reason, "server");
        }

        return rsp.Reconn;
    }

    public async close_session(room_id: string): Promise<void> {
        try {
            // console.log("close session ...");
            const rsp = await this.invoke({
                typ: {
                    Close: {
                        room_id,
                    },
                }
            }, "close_session");
            console.log("close_session response", rsp);  
            
            this.cleanUp();

            // return rsp.Close;
        } catch (err) {
            console.log("close_session error", err);
            this.cleanUp();
        }
    }

    public async end_room(room_id: string): Promise<void> {
        try {
            // console.log("end room ...", room_id);
            const rsp = await this.invoke({
                typ: {
                    End: {
                        room_id,
                    },
                }
            }, "end_room");
            console.log("end_room response", rsp);   

            this.cleanUp();

            // return rsp.End;
        } catch (err) {
            console.log("end_room error", err);
            this.cleanUp();
        }

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

    public async updateUserTree(req: {path: string, value?: string, prune?: boolean}) : Promise<any> {
        const rsp = await this.invoke({
            typ: {
                UpUTree: req,
            }
        }, "updateUserTree");

        return rsp.UpUTree;
    }

    public async updateRoomTree(req: {path: string, value?: string, prune?: boolean}) : Promise<any> {
        const rsp = await this.invoke({
            typ: {
                UpRTree: req,
            }
        }, "updateRoomTree");

        return rsp.UpRTree;
    }

    public async chat(req: {body: string, to?: string}) : Promise<any> {
        const rsp = await this.invoke({
            typ: {
                Chat: req,
            }
        }, "Chat");

        return rsp.Chat;
    }
}


enum PacketType {
    Request = 3,
    Response = 4,
    Push0 = 5,  // 不需要回 ack
    Push1 = 6,  // 不需要立即回 ack
    Push2 = 7,  // 尽可能快回 ack
}
