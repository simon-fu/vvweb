export const ROUTER_RTP_CAPABILITIES: any = {
    "codecs": [
        {
            "channels": 2,
            "clockRate": 48000,
            "kind": "audio",
            "mimeType": "audio/opus",
            "parameters": {},
            "preferredPayloadType": 100,
            "rtcpFeedback": [
                {
                    "parameter": "",
                    "type": "nack"
                },
                {
                    "parameter": "",
                    "type": "transport-cc"
                }
            ]
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
        },

        {
            "clockRate": 90000,
            "kind": "video",
            "mimeType": "video/VP9",
            "parameters": {
                "profile-id": 0,
                "x-google-start-bitrate": 1000
            },
            "preferredPayloadType": 106,
            "rtcpFeedback": [{
                "parameter": "",
                "type": "nack"
            },
                {
                    "parameter": "pli",
                    "type": "nack"
                },
                {
                    "parameter": "pli",
                    "type": "nack"
                },
                {
                    "parameter": "fir",
                    "type": "ccm"
                },
                {
                    "parameter": "",
                    "type": "goog-remb"
                },
                {
                    "parameter": "",
                    "type": "transport-cc"
                }
            ]
        },
        {
            "clockRate": 90000,
            "kind": "video",
            "mimeType": "video/rtx",
            "parameters": {
                "apt": 106
            },
            "preferredPayloadType": 107,
            "rtcpFeedback": []
        },

        {
            "clockRate": 90000,
            "kind": "video",
            "mimeType": "video/H264",
            "parameters": {
                "level-asymmetry-allowed": 1,
                "packetization-mode": 1,
                "profile-level-id": "42001f",
                "x-google-start-bitrate": 1000
            },
            "preferredPayloadType": 109,
            "rtcpFeedback": [{
                "parameter": "",
                "type": "nack"
            },
                {
                    "parameter": "pli",
                    "type": "nack"
                },
                {
                    "parameter": "fir",
                    "type": "ccm"
                },
                {
                    "parameter": "",
                    "type": "goog-remb"
                },
                {
                    "parameter": "",
                    "type": "transport-cc"
                }
            ]
        },
        {
            "clockRate": 90000,
            "kind": "video",
            "mimeType": "video/rtx",
            "parameters": {
                "apt": 109
            },
            "preferredPayloadType": 110,
            "rtcpFeedback": []
        }
    ],
    "headerExtensions": [
        {
            "direction": "sendrecv",
            "kind": "audio",
            "preferredEncrypt": false,
            "preferredId": 1,
            "uri": "urn:ietf:params:rtp-hdrext:sdes:mid"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 1,
            "uri": "urn:ietf:params:rtp-hdrext:sdes:mid"
        },
        {
            "direction": "recvonly",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 2,
            "uri": "urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id"
        },
        {
            "direction": "recvonly",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 3,
            "uri": "urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id"
        },
        {
            "direction": "sendrecv",
            "kind": "audio",
            "preferredEncrypt": false,
            "preferredId": 4,
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 4,
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time"
        },
        {
            "direction": "recvonly",
            "kind": "audio",
            "preferredEncrypt": false,
            "preferredId": 5,
            "uri": "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 5,
            "uri": "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 6,
            "uri": "http://tools.ietf.org/html/draft-ietf-avtext-framemarking-07"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 7,
            "uri": "urn:ietf:params:rtp-hdrext:framemarking"
        },
        {
            "direction": "sendrecv",
            "kind": "audio",
            "preferredEncrypt": false,
            "preferredId": 10,
            "uri": "urn:ietf:params:rtp-hdrext:ssrc-audio-level"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 11,
            "uri": "urn:3gpp:video-orientation"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 12,
            "uri": "urn:ietf:params:rtp-hdrext:toffset"
        },
        {
            "direction": "sendrecv",
            "kind": "audio",
            "preferredEncrypt": false,
            "preferredId": 13,
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time"
        },
        {
            "direction": "sendrecv",
            "kind": "video",
            "preferredEncrypt": false,
            "preferredId": 13,
            "uri": "http://www.webrtc.org/experiments/rtp-hdrext/abs-capture-time"
        }
    ]
}
