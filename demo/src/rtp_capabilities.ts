export const ROUTER_RTP_CAPABILITIES: any = {
    "codecs": [
        {
            "kind": "audio",
            "mimeType": "audio/opus",
            "preferredPayloadType": 100,
            "clockRate": 48000,
            "channels": 2,
            "parameters": {
                "useinbandfec": 1
            },
            "rtcpFeedback": [
                {
                    "type": "nack",
                    "parameter": ""
                },
                {
                    "type": "transport-cc",
                    "parameter": ""
                }
            ]
        },
        {
            "kind": "audio",
            "mimeType": "audio/rtx",
            "preferredPayloadType": 101,
            "clockRate": 48000,
            "channels": 2,
            "parameters": {
                "apt": 100
            },
            "rtcpFeedback": []
        },
        {
            "kind": "audio",
            "mimeType": "audio/red",
            "preferredPayloadType": 102,
            "clockRate": 48000,
            "channels": 2,
            "parameters": {
                "apt": 100
            },
            "rtcpFeedback": []
        },
        {
            "kind": "video",
            "mimeType": "video/VP8",
            "preferredPayloadType": 103,
            "clockRate": 90000,
            "parameters": {},
            "rtcpFeedback": [
                {
                    "type": "nack",
                    "parameter": ""
                },
                {
                    "type": "nack",
                    "parameter": "pli"
                },
                {
                    "type": "ccm",
                    "parameter": "fir"
                },
                {
                    "type": "goog-remb",
                    "parameter": ""
                },
                {
                    "type": "transport-cc",
                    "parameter": ""
                }
            ]
        },
        {
            "kind": "video",
            "mimeType": "video/rtx",
            "preferredPayloadType": 104,
            "clockRate": 90000,
            "parameters": {
                "apt": 103
            },
            "rtcpFeedback": []
        },
        {
            "kind": "video",
            "mimeType": "video/flexfec-03",
            "preferredPayloadType": 105,
            "clockRate": 90000,
            "parameters": {
                "apt": 103
            },
            "rtcpFeedback": []
        }
    ],
    "headerExtensions": [
        {
            "kind": "audio",
            "uri": "urn:ietf:params:rtp-hdrext:sdes:mid",
            "preferredId": 1,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "urn:ietf:params:rtp-hdrext:sdes:mid",
            "preferredId": 1,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id",
            "preferredId": 2,
            "preferredEncrypt": false,
            "direction": "recvonly"
        },
        {
            "kind": "video",
            "uri": "urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id",
            "preferredId": 3,
            "preferredEncrypt": false,
            "direction": "recvonly"
        },
        {
            "kind": "audio",
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
            "preferredId": 4,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time",
            "preferredId": 4,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "audio",
            "uri": "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
            "preferredId": 5,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01",
            "preferredId": 5,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "http://tools.ietf.org/html/draft-ietf-avtext-framemarking-07",
            "preferredId": 6,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "urn:ietf:params:rtp-hdrext:framemarking",
            "preferredId": 7,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "audio",
            "uri": "urn:ietf:params:rtp-hdrext:ssrc-audio-level",
            "preferredId": 10,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "urn:3gpp:video-orientation",
            "preferredId": 11,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "urn:ietf:params:rtp-hdrext:toffset",
            "preferredId": 12,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "audio",
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time",
            "preferredId": 13,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time",
            "preferredId": 13,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "audio",
            "uri": "Hx-Private-AudioRoom-Stream",
            "preferredId": 14,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        },
        {
            "kind": "video",
            "uri": "Hx-Private-AudioRoom-Stream",
            "preferredId": 14,
            "preferredEncrypt": false,
            "direction": "sendrecv"
        }
    ]
}; 
