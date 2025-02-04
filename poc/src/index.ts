/* eslint-disable no-console */
import { Device } from 'mediasoup-client';
import { Transport } from 'mediasoup-client/lib/Transport';
import { Producer } from 'mediasoup-client/lib/Producer';
import { AppData } from 'mediasoup-client/lib/types';
import { Client } from "./client";
import { ROUTER_RTP_CAPABILITIES } from './rtp_capabilities';


// 将按钮点击事件封装为 Promise
function waitForClick(element: HTMLElement): Promise<void> {
	return new Promise((resolve) => {
		element.addEventListener('click', () => resolve(), { once: true });
		// element.addEventListener('click', () => resolve());
	});
}


// 定义 Result 类型
type Result<T, E> = { type: 'ok', value: T } | { type: 'err', error: E };

// 模拟连接 WebSocket
function ws_connect(url: string, timeout = 5000): Promise<Result<WebSocket, Error>> {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);

		let timer = setTimeout(() => {
            ws.close();
			resolve({ type: 'err', error: new Error('WebSocket connection timed out') });
        }, timeout);

        ws.onopen = () => {
			clearTimeout(timer);
            resolve({ type: 'ok', value: ws });
        };

        ws.onerror = (_event) => {
			clearTimeout(timer);
            resolve({ type: 'err', error: new Error('WebSocket connection failed') });
        };

        ws.onclose = (_event) => {
            // 如果关闭了连接，也视为错误
            resolve({ type: 'err', error: new Error('WebSocket connection closed unexpectedly') });
        };
    });
}

// interface ProducerExt {
// 	stream_id?: string;
// }

interface State {
	member_id: string;
	room_id: string;
	// audio_stream_id?: string,
	// video_stream_id?: string,
	device?: Device,
	client?: Client;
	producers?: Producer<AppData>[],
}
  

// 全局状态，类型 any 的目的是避免 ts 的类型检查 
let gState: State = { 
	member_id: "default-member",
	room_id: "default-room",
	// audio_stream_id: "audio-stream",
	// video_stream_id: "video-stream",
};


async function run(ws: WebSocket) {
	try {
		const device = new Device();
		await device.load({
			routerRtpCapabilities: ROUTER_RTP_CAPABILITIES,
		});
		console.log("device loaded");

		const client = new Client(ws, gState.member_id);

		{
			console.log("open session ...");
			const rsp = await client.open_session();
			console.log("opened session:", rsp);
		}

		let producerTransport ;
		let producerTransportId: string ;
		{
			console.log("create server producer transport ...");
			const rsp = await client.create_producer_transport(gState.room_id);
			console.log("created server producer transport", rsp);
			producerTransportId = rsp.transportId;

			rsp.dtlsParameters.role = "server";
			rsp.dtlsParameters.fingerprints = [rsp.dtlsParameters.fingerprints];

			// const ext: ProducerExt = {};

			producerTransport = device.createSendTransport({
				id             : producerTransportId,
				iceParameters  : rsp.iceParameters,
				iceCandidates  : rsp.iceCandidates,
				dtlsParameters : rsp.dtlsParameters,
				// appData        : ext,
				// sctpParameters : { ... }
			});
			console.log("created local send transport", producerTransport);
		}

		producerTransport
			.on('connect', async ({ dtlsParameters }, success, fail) =>
			{
				// 创建第一个 producer 时才会回调到这里
				console.log("producerTransport on connect", dtlsParameters);
				
				try {
					const rsp = await client.connect_transport(gState.room_id, producerTransportId, dtlsParameters);
					console.log("connected producerTransport", producerTransportId, rsp);
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

					const rsp = await client.publish(gState.room_id, producerTransportId, stream_id, kind, rtpParameters);
					appData.stream_id = stream_id;
					console.log("published stream", stream_id, "transport", producerTransportId, rsp);
					success({ id: rsp.producerId });
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					fail(error);
				}
			});

		const mediaStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: false // TODO: 正式代码要开启回音消除
			},
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

		const sendPreview = document.querySelector('#preview-send') as HTMLVideoElement;
	
		sendPreview.onloadedmetadata = () =>
		{
			sendPreview.play();
		};

		sendPreview.srcObject = mediaStream;

		const producers = [];

		for (const track of mediaStream.getTracks())
		{
			const producer = await producerTransport.produce({ track });

			producers.push(producer);
			console.log(`${track.kind} producer created:`, producer);
		}

		gState.device = device;
		gState.producers = producers;
		gState.client = client;

		await subscribe_streams();
		

	} catch (error) {
		console.error("run but error:", error);
	}

	await new Promise((resolve) => {
		ws.onclose = (event) => {
			console.log("WebSocket connection closed", event);
			resolve(undefined);
		}; 
	});
}

async function subscribe_stream(client: Client, producer: Producer, transport: Transport, receiveMediaStream: MediaStream, receivePreview: HTMLVideoElement) {

	const stream_id = producer.appData.stream_id as string;

	console.log("subscribing stream", stream_id);
	const rsp = await client.subscribe(gState.room_id, transport.id, stream_id, producer.id);
	console.log("subscribed", rsp);

	const consumer = await transport.consume({
		id: rsp.consumerId, 
		producerId: producer.id, 
		kind: producer.kind, 
		rtpParameters: rsp.rtpParameters, 
		streamId: stream_id,
	});

	console.log(`${consumer.kind} consumer created:`, consumer);

	receiveMediaStream.addTrack(consumer.track);
	receivePreview.srcObject = receiveMediaStream;
}

async function subscribe_streams() {
	if (!gState.producers || !gState.client || !gState.device) {
		return;
	}

	const receivePreview = document.querySelector('#preview-receive') as HTMLVideoElement;
	receivePreview.onloadedmetadata = () =>
	{
		receivePreview.play();
		receivePreview.muted = false;
	};

	const device = gState.device;
	const producers = gState.producers;
	const client = gState.client;

	let consumerTransport ;
	let consumerTransportId: string ;
	{
		console.log("create server consumer transport ...");
		const rsp = await client.create_consumer_transport(gState.room_id);
		console.log("created server consumer transport", rsp);
		consumerTransportId = rsp.transportId;

		rsp.dtlsParameters.role = "server";
		rsp.dtlsParameters.fingerprints = [rsp.dtlsParameters.fingerprints];

		consumerTransport = device.createRecvTransport({
			id             : consumerTransportId,
			iceParameters  : rsp.iceParameters,
			iceCandidates  : rsp.iceCandidates,
			dtlsParameters : rsp.dtlsParameters,
			// sctpParameters : { ... }
		});
		console.log("created local recv transport", consumerTransport);
	}

	consumerTransport.on('connect', async ({ dtlsParameters }, success, fail) => {
		console.log("consumer on connect", dtlsParameters);

		try {
			const rsp = await client.connect_transport(gState.room_id, consumerTransportId, dtlsParameters);
			console.log("connected producerTransport", consumerTransportId, rsp);
			success();
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			fail(error);
		}
	
	});


	
	const receiveMediaStream = new MediaStream();
	
	// const consumers = [];
	// for (const producer of producers) {
	// 	const stream_id = producer.appData.stream_id as string;
	// 	console.log("subscribing stream", stream_id);
	// 	const rsp = await client.subscribe(gState.room_id, consumerTransportId, stream_id, producer.id);
	// 	console.log("subscribed", rsp);

	// 	const consumer = await (consumerTransport as Transport).consume({
	// 		id: rsp.consumerId, 
	// 		producerId: producer.id, 
	// 		kind: producer.kind, 
	// 		rtpParameters: rsp.rtpParameters, 
	// 		streamId: stream_id,
	// 	});

	// 	console.log(`${consumer.kind} consumer created:`, consumer);
	// 	consumers.push(consumer);

	// 	receiveMediaStream.addTrack(consumer.track);
	// 	receivePreview.srcObject = receiveMediaStream;
	// }

	let promises = [];

	for (const producer of producers) {
		promises.push(subscribe_stream(client, producer, consumerTransport, receiveMediaStream, receivePreview));
	}

	const results = await Promise.allSettled(promises);

	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			console.log(`Data ${index + 1}:`, result.value);
		} else {
			console.error(`Error in request ${index + 1}:`, result.reason);
		}
	});
}
// async function sleep(ms: number) {
//     await new Promise(resolve => setTimeout(resolve, ms));
// }

async function main() {

	const button = document.getElementById('button_start') as HTMLButtonElement | null;
	console.log('获取 button', button);
	
	if (!button) {
		return 
	}

	while (true) {
		console.log('等待点击');
		await waitForClick(button);
		console.log('点击完成');

		const url = "ws://127.0.0.1:11080/ws";
		// const url = "ws://localhost:3000/ws";
		// const url = "ws://baidu.com:3000/ws"; // 不存在的地址

		console.log('Websocket connecting to', url);
		const result = await ws_connect(url);

		if (result.type === 'ok') {
			console.log("WebSocket connected:", result.value);
			let ws = result.value;
			if (ws) {
				await run(ws);
			} else {
				// init();
			}
			
		} else {
			console.error("Connection failed:", result.error);
		}
	}

}

main();
