/* eslint-disable no-console */
import { Device } from 'mediasoup-client';
import { Transport } from 'mediasoup-client/lib/Transport';
import { Producer } from 'mediasoup-client/lib/Producer';
import { AppData } from 'mediasoup-client/lib/types';
import { Client, User, Notice, Stream } from "./client";
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


interface UserGrid {
	video: HTMLVideoElement;
}

interface UserCell {
	state: User;
	grid: UserGrid;
	media_stream?: MediaStream;
	sub_tracks: Map<String, MediaStreamTrack|null>;
}

interface State {
	user_id: string;
	room_id: string;
	device?: Device,
	client?: Client;
	consumerTransport?: Transport<AppData>,
	producers?: Producer<AppData>[],
	users: Map<string, UserCell>, //  { [key: string]: UserCell };
}
  

let gState: State = { 
	user_id: "default-member",
	room_id: "default-room",
	users: new Map,
	// audio_stream_id: "audio-stream",
	// video_stream_id: "video-stream",
};

async function update_user(user: User) {
	
	const cell = gState.users.get(user.id);
	if (!cell) {
		console.log("add user", user);

		const grid = ui_add_recv_grid(user.id);

		grid.video.onloadedmetadata = () =>
		{
			grid.video.play();
			// grid.video.muted = false;
		};

		const cell: UserCell = {
			state: user,
			grid,
			sub_tracks: new Map,
		};
		gState.users.set(user.id, cell);

		await try_subscribe_user(cell);
	} else {
		console.log("update user", user);
		// TODO: 比较新旧状态
		cell.state = user;
		await try_subscribe_user(cell);
	}
}

async function run(ws: WebSocket) {
	try {
		const device = new Device();
		await device.load({
			routerRtpCapabilities: ROUTER_RTP_CAPABILITIES,
		});
		console.log("device loaded");

		gState.user_id = input_user.value;
		gState.room_id = input_room.value;

		const client = new Client(ws, gState.user_id);
		client.on("notice", async (notice: Notice) => {
			console.log("recv notice", notice);
			if (notice.body.User) {
				const user: User = notice.body.User;
				await update_user(user);
			} else {
				console.warn("unknown notice", notice);
			}
		});

		{
			console.log("open session ...");
			const rsp = await client.open_session(gState.room_id);
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
				// 创建第一个 producer 时才会执行到这里
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

		await create_recv_transport();

		await try_subscribe_users();

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

function mediasoup_kind(kind: number): 'audio' | 'video' {
	return kind == 1 ? "audio" : "video"
}

async function try_subscribe_users() {
	let promises: Promise<void>[] = [];

	gState.users.forEach((user, _) => {
		promises.push(try_subscribe_user(user));
	});

	const results = await Promise.allSettled(promises);

	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			console.log(`Data ${index + 1}:`, result.value);
		} else {
			console.error(`Error in request ${index + 1}:`, result.reason);
		}
	});
}

async function try_subscribe_user(user: UserCell) {
	const consumerTransport = gState.consumerTransport;
	const client = gState.client;
	const room_id = gState.room_id;

	if (!client || !consumerTransport || !user.state.streams) {
		return;
	}

	try {
		await subscribe_user(user, client, room_id, consumerTransport);
	}catch (err) {
		console.error("subscribe user failed", err, user.state.id);
	}
}

async function subscribe_user(user: UserCell, client: Client, room_id: string, consumerTransport: Transport ) {
	

	let promises: Promise<void>[] = [];


	Object.entries(user.state.streams).forEach(([stream_id, stream]) => {
		console.log("Stream:", stream);

		const op = try_sub_user_track(client, room_id, stream_id, stream, consumerTransport, user);

		promises.push(op);
	})

	const results = await Promise.allSettled(promises);

	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			console.log(`Data ${index + 1}:`, result.value);
		} else {
			console.error(`Error in request ${index + 1}:`, result.reason);
		}
	});
}

async function try_sub_user_track(client: Client, room_id: string, stream_id: string, stream: Stream, transport: Transport, cell: UserCell) {

	if (cell.sub_tracks.has(stream_id)) {
		return;
	}

	cell.sub_tracks.set(stream_id, null);

	try {
		const track = await subscribe_track(client, room_id, stream_id, stream, transport);

		if (!cell.media_stream) {
			cell.media_stream = new MediaStream();
		}
		const media_stream = cell.media_stream;
	
		media_stream.addTrack(track);

		cell.grid.video.srcObject = media_stream;

		cell.sub_tracks.set(stream_id, track);
		console.log("subscribed track", stream_id, track);
	} catch (err) {
		cell.sub_tracks.delete(stream_id);
	}
}


async function subscribe_track(client: Client, room_id: string, stream_id: string, stream: Stream, transport: Transport): Promise<MediaStreamTrack> {

	// const stream_id = producer.appData.stream_id as string;
	const producer_id = stream.producer_id;

	console.log("subscribing stream", stream_id);
	const rsp = await client.subscribe(room_id, transport.id, stream_id, producer_id);
	console.log("subscribed", rsp);

	const consumer = await transport.consume({
		id: rsp.consumerId, 
		producerId: producer_id, 
		kind: mediasoup_kind(stream.kind), 
		rtpParameters: rsp.rtpParameters, 
		streamId: stream_id,
	});

	console.log(`${consumer.kind} consumer created:`, consumer);

	return consumer.track;
}

async function create_recv_transport() {
	const device = gState.device;
	const client = gState.client;

	if (!device || !client) {
		return;
	}

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

	gState.consumerTransport = consumerTransport;
}




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

		
		const url = input_url.value;
		console.log('Websocket connecting to', url);
		const result = await ws_connect(url);

		if (result.type === 'ok') {
			console.log("WebSocket connected:", result.value);
			let ws = result.value;
			await run(ws);
			
		} else {
			console.error("Connection failed:", result.error);
		}
	}

}

// 定义函数，用于动态创建一个新的接收视频区块
function ui_add_recv_grid(id: string): UserGrid {
	// 创建外层 grid_item 容器
	const gridItem = document.createElement('div');
	gridItem.className = 'grid_item';
	// 如果需要，也可以设置 id，例如：
	gridItem.id = id; // 'receive-grid-99';

	// 创建包含 video 的容器和 video 元素
	const videoContainer = document.createElement('div');
	const video = document.createElement('video');
	video.setAttribute('muted', '');
	video.setAttribute('controls', '');
	// 可为新 video 元素设置动态 id
	// video.id = 'preview-receive-' + Date.now();
	videoContainer.appendChild(video);

	// 创建包含按钮的容器和按钮元素
	const buttonContainer = document.createElement('div');
	
	const nameLabel = document.createElement('label');
	nameLabel.textContent = id;
	buttonContainer.appendChild(nameLabel);

	const button = document.createElement('button');
	button.textContent = '订阅视频';
	button.hidden = true;
	// 可为新按钮设置动态 id
	// button.id = 'button-sub-video-' + Date.now();
	buttonContainer.appendChild(button);

	// 将 video 容器和按钮容器添加到 grid_item 中
	gridItem.appendChild(videoContainer);
	gridItem.appendChild(buttonContainer);

	// 将新创建的 grid_item 添加到 grid_container 中
	const gridContainer = document.querySelector('.grid_container');
	
	if (gridContainer) {
		gridContainer.appendChild(gridItem);
	}

	return {
		video,
	};
}

function generateRandomString(
	length: number,
	chars: string = 'abcdefghijklmnopqrstuvwxyz0123456789'
	// chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
return Array.from({ length }, () => {
	const randomIndex = Math.floor(Math.random() * chars.length);
	return chars[randomIndex];
}).join('');
}

const url_params = new URLSearchParams(window.location.search);

const URL = "ws://127.0.0.1:11080/ws";
// const URL = "ws://localhost:3000/ws";
// const URL = "ws://baidu.com:3000/ws"; // 不存在的地址

const input_url = document.getElementById('input_url') as HTMLInputElement;
if (input_url) {
	input_url.value = url_params.get("ws") ?? URL ;
}

const ROOM = "room01";
const input_room = document.getElementById('input_room') as HTMLInputElement;
if (input_room) {
	input_room.value = url_params.get("room") ?? ROOM;
}

// const USER = "user01";
const input_user = document.getElementById('input_user') as HTMLInputElement;
if (input_user) {
	input_user.value = url_params.get("user") ?? generateRandomString(6);
}

const button_pub_video = document.getElementById('button-pub-video') as HTMLButtonElement | null;
if (button_pub_video) {
	button_pub_video.addEventListener('click', () => {
		const id = 'receive-grid-99';
		const grid = document.getElementById(id) as HTMLButtonElement | null;
		if (grid) {
			grid.remove();
		} else {
			ui_add_recv_grid(id);
		}
	});
}



main();
