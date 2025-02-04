import { DtlsParameters } from 'mediasoup-client/lib/Transport';
import { MediaKind, RtpParameters } from 'mediasoup-client/lib/RtpParameters';

type Result<T, E> = { type: 'ok', value: T } | { type: 'err', error: E };

const mediaKindMap: Record<MediaKind, number> = {
    audio: 1,
    video: 2
};

const APP_ID = "default-app"; // "BEE70049B999BB338E787A4AD20A804333C949C3";
const CALL_ID = "default-call";
const CHAIN_ID = "default-chain"; // "74aea504-e8ec-4de1-ba78-ae5af4fba699"



export class Client {
    private ws: WebSocket;
    private pendingRequests: Map< number, { 
        resolve: (value: any) => void; 
        reject: (reason?: any) => void;
    }>;
    private msgIdCounter: number;
    private sessionId: string;
    private memberId: string;

    constructor(wsOrUrl: WebSocket | string, memberId: string) {
        this.ws = typeof wsOrUrl === "string" ? new WebSocket(wsOrUrl) : wsOrUrl;
        this.memberId = memberId;
        this.pendingRequests = new Map();
        this.msgIdCounter = 1;
        this.sessionId = "";

        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onerror = this.handleError.bind(this);
        this.ws.onclose = this.handleClose.bind(this);
    }

    private handleMessage(event: MessageEvent) {
        
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
        console.error("WebSocket closed", event);

        for (const [, { reject }] of this.pendingRequests) {
            reject(new Error("WebSocket closed"));
        }
        this.pendingRequests.clear();
    }

    public async invoke(req: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const msg_id = this.msgIdCounter++;
            req.msg_id = msg_id;
            
            this.pendingRequests.set(msg_id, { resolve, reject });
            this.ws.send(JSON.stringify(req));
        });
    }

    public async try_invoke(req: any): Promise<Result<any, Error>> {
        try {
            const response = await this.invoke(req);
            return { type: 'ok', value: response };
        } catch (error) {
            return { type: 'err', error: error instanceof Error ? error : new Error(String(error)) };
        }
    }

    public async open_session(): Promise<any> {
        // console.log("open session ...");
        const rsp = await this.invoke({
            // msg_id: next_msg_id(),
            msg_type: {
                OpenSession: {},
            }
        });
        // console.log("opened response:", rsp.OpenSessionResponse);
        this.sessionId = rsp.OpenSessionResponse.session_id;
        return rsp.OpenSessionResponse;
    }

    public async create_producer_transport(roomId: string): Promise<any> {
        const rsp = await this.invoke({
            msg_type: {
                CreateWebrtcTransport: {
                    appId: APP_ID, 
                    roomId, 
                    roomName: roomId, 
                    memberId: this.memberId, 
                    direction: 0, // Inbound = 0, Outbound = 1
                    kind: 0,  // AudioVideo = 0, Audio = 1, Video = 2,
                    callId: CALL_ID, 
                    chainId: CHAIN_ID, 
                    clientType: 5, // WEB = 5, 
                    sessionId: this.sessionId, 
                    // dtls_parameters: None, 
                    // support_abilities: None
                },
            }
        });
        return rsp.CreateWebrtcTransportResponse;
    }

    public async create_consumer_transport(roomId: string): Promise<any> {
        const rsp = await this.invoke({
            msg_type: {
                CreateWebrtcTransport: {
                    appId: APP_ID, 
                    roomId, 
                    roomName: roomId, 
                    memberId: this.memberId, 
                    direction: 1, // Inbound = 0, Outbound = 1
                    kind: 0,  // AudioVideo = 0, Audio = 1, Video = 2,
                    callId: CALL_ID, 
                    chainId: CHAIN_ID, 
                    clientType: 5, // WEB = 5, 
                    sessionId: this.sessionId, 
                    // dtls_parameters: None, 
                    // support_abilities: None
                },
            }
        });
        return rsp.CreateWebrtcTransportResponse;
    }

    public async connect_transport(roomId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<any> {
        const rsp = await this.invoke({
            msg_type: {
                ConnectWebrtcTransport: {
                    roomId, 
                    transportId,
                    dtlsParameters: {
                        role: 0, // Client = 0,
                        fingerprints: dtlsParameters.fingerprints[0],
                    }
                },
            }
        });
        return rsp.ConnectWebrtcTransportResponse;
    }

    public async publish(roomId: string, transportId: string, streamId: string, kind: MediaKind, rtpParametersTyped: RtpParameters): Promise<any> {
        const codecs = rtpParametersTyped.codecs;
        const encodings = rtpParametersTyped.encodings;
        const rtpParameters: any = rtpParametersTyped;

        rtpParameters.headerExtensions = rtpParameters.headerExtensions ? JSON.stringify(rtpParameters.headerExtensions) : "[]";

        rtpParameters.rtcp = rtpParameters.rtcp ? JSON.stringify(rtpParameters.rtcp) : "";

        rtpParameters.codecs = [];
        for (const item of codecs) {
            rtpParameters.codecs.push({
                mimeType: item.mimeType ? item.mimeType : "",
                payloadType: item.payloadType ? item.payloadType : 0,
                channels: item.channels ? item.channels: 0,
                clockRate: item.clockRate ? item.clockRate : 0,
                parameters: item.parameters ? JSON.stringify(item.parameters) : "{}",
                rtcpFeedback: item.rtcpFeedback ? JSON.stringify(item.rtcpFeedback) : "[]",
            });
        }
        
        rtpParameters.encodings = [];
        if (encodings) {
            for (const item of encodings) {
                rtpParameters.encodings.push({
                    ssrc: item.ssrc ? item.ssrc : 0,
                    rtxSsrc: item.rtx? item.rtx.ssrc : 0,
                    rid: item.rid ? item.rid : "",
                    payloadType: item.codecPayloadType ? item.codecPayloadType : 0,
                    dtx: item.dtx ? item.dtx : false,
                    scalabilityMode: item.scalabilityMode ? item.scalabilityMode : "",
                    scaleResolutionDownBy: item.scaleResolutionDownBy ? item.scaleResolutionDownBy : 0,
                    fecSsrc: 0,
                })
            }
        }


        const rsp = await this.invoke({
            msg_type: {
                Publish: {
                    roomId, 
                    transportId,
                    streamId,
                    kind: mediaKindMap[kind],
                    rtpParameters,
                    audioType: 0, // RoutableAudio = 0, ExclusiveAudio = 1, PriorityRoomAudio = 2,
                    local: [],
                },
            }
        });
        return rsp.Publish;

    }

    public async subscribe(roomId: string, transportId: string, streamId: string, producerId: string): Promise<any> {
        const rsp = await this.invoke({
            msg_type: {
                Subscribe: {
                    roomId, 
                    transportId,
                    streamId,
                    producerId,
                    preferred_layers: null,
                    source: null,
                },
            }
        });

        const src = rsp.Subscribe.rtpParameters;
        console.log("src rtpParameters", src);

        const codecs = src.codecs;
        const encodings = src.encodings;

        const rtpParameters: RtpParameters = {
            mid: src.mid,
            headerExtensions: JSON.parse(src.headerExtensions),
            rtcp: src.rtcp === null || src.rtcp === "" ? undefined : JSON.parse(src.rtcp),
            codecs: [],
            encodings: [],
        };

        for (const item of codecs) {
            rtpParameters.codecs.push({
                mimeType: item.mimeType ,
                payloadType: item.payloadType ,
                channels: item.channels ,
                clockRate: item.clockRate > 0 ? item.clockRate : undefined,
                parameters: !!item.parameters ? JSON.parse(item.parameters) : undefined,
                rtcpFeedback: !!item.rtcpFeedback ? JSON.parse(item.rtcpFeedback) : undefined,
            });
        }

        rtpParameters.encodings = [];
        for (const item of encodings) {
            rtpParameters.encodings.push({
                ssrc: item.ssrc ,
                rtx: item.rtxSsrc > 0 ? {ssrc: item.rtxSsrc} : undefined,
                rid: !!item.rid ? item.rid : undefined,
                codecPayloadType: item.payloadType > 0 ? item.payloadType : undefined,
                dtx: item.dtx ,
                // scalabilityMode: !!item.scalabilityMode ? item.scalabilityMode : undefined,
                // scaleResolutionDownBy: item.scaleResolutionDownBy ,
            })
        }

        // {
        //     "mid": "0",
        //     "codecs": [
        //         {
        //             "mimeType": "audio/opus",
        //             "payloadType": 100,
        //             "channels": 2,
        //             "clockRate": 48000,
        //             "parameters": "{\"minptime\":10,\"useinbandfec\":1}",
        //             "rtcpFeedback": "[{\"type\":\"transport-cc\",\"parameter\":\"\"}]"
        //         }
        //     ],
        //     "headerExtensions": "[{\"uri\":\"urn:ietf:params:rtp-hdrext:sdes:mid\",\"id\":1,\"encrypt\":false},{\"uri\":\"http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\",\"id\":4,\"encrypt\":false},{\"uri\":\"http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\",\"id\":5,\"encrypt\":false},{\"uri\":\"urn:ietf:params:rtp-hdrext:ssrc-audio-level\",\"id\":10,\"encrypt\":false},{\"uri\":\"http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time\",\"id\":13,\"encrypt\":false},{\"uri\":\"Hx-Private-AudioRoom-Stream\",\"id\":14,\"encrypt\":false}]",
        //     "encodings": [
        //         {
        //             "ssrc": 125433032,
        //             "rtxSsrc": 0,
        //             "rid": "",
        //             "payloadType": 0,
        //             "dtx": false,
        //             "scalabilityMode": "S1T1",
        //             "scaleResolutionDownBy": 0,
        //             "fecSsrc": 0
        //         }
        //     ],
        //     "rtcp": "{\"cname\":\"ARk7s3sZnJYkwrQb\",\"reducedSize\":true}"
        // }

        rsp.Subscribe.rtpParameters = rtpParameters;
        return rsp.Subscribe;
    }
}
