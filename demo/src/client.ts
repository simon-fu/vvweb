import { DtlsParameters } from 'mediasoup-client/lib/Transport';
import { RtpParameters } from 'mediasoup-client/lib/RtpParameters';
import { EventEmitter, Listener } from "./emitter";

// type Result<T, E> = { type: 'ok', value: T } | { type: 'err', error: E };

// const MEDIA_KIND_MAP: Record<MediaKind, number> = {
//     audio: 1,
//     video: 2
// };

// const APP_ID = "default-app"; // "BEE70049B999BB338E787A4AD20A804333C949C3";
// const CALL_ID = "default-call";
// const CHAIN_ID = "default-chain"; // "74aea504-e8ec-4de1-ba78-ae5af4fba699"


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


export class Client {
    private ws: WebSocket;

    private emitter: EventEmitter;

    private pendingRequests: Map< number, { 
        origin: string;
        resolve: (value: any) => void; 
        reject: (reason?: any) => void;
    }>;
    private msgIdCounter: number;
    // private sessionId: string;
    private userId: string;

    constructor(wsOrUrl: WebSocket | string, userId: string) {
        this.ws = typeof wsOrUrl === "string" ? new WebSocket(wsOrUrl) : wsOrUrl;
        this.userId = userId;
        this.pendingRequests = new Map();
        this.msgIdCounter = 1;
        // this.sessionId = "";
        this.emitter = new EventEmitter();

        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onerror = this.handleError.bind(this);
        this.ws.onclose = this.handleClose.bind(this);
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
                const handled = this.trigger("notice", notice);
                if (handled) {
                    return;
                }
            } else if (msg.msg_type.ClosedNotice) {
                const handled = this.trigger("closed", msg.msg_type.ClosedNotice);
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
    }

    public async invoke(req: any, origin: string): Promise<any> {
        return new Promise((resolve, reject) => {
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
    private trigger<T>(event: string, data: T): Boolean {
        return this.emitter.emit(event, data);
    }

    public async open_session(room_id: string, user_ext?: string): Promise<any> {
        // console.log("open session ...");
        const rsp = await this.invoke({
            // msg_id: next_msg_id(),
            typ: {
                Open: {
                    user_id: this.userId,
                    room_id,
                    user_ext,
                },
            }
        }, "open_session");
        // console.log("opened response:", rsp.OpenSessionResponse);
        // this.sessionId = rsp.OpenSessionResponse.session_id;
        return rsp.Open;
    }

    public async close_session(room_id: string): Promise<any> {
        // console.log("close session ...");
        const rsp = await this.invoke({
            typ: {
                Close: {
                    room_id,
                },
            }
        }, "close_session");

        this.ws.close();

        return rsp.Close;
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

        this.ws.close();

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

    public async updateConsumeVideoLayer(roomId: string, consumerId: string, small?: boolean) {
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
}

