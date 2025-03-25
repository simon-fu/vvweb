/* eslint-disable no-console */

import { VVRTC } from './vvrtc';

interface UserGrid {
	video: HTMLVideoElement;
	grid: HTMLDivElement,
}

class App {
	private startButton: HTMLButtonElement;
	private sendPreview: HTMLVideoElement;

	private vrtc?: VVRTC;
	private users: Map<string, UserGrid>;

	public constructor() {
		this.users = new Map;

		this.sendPreview = document.querySelector('#preview-send') as HTMLVideoElement;
		initVideo(this.sendPreview);

		this.startButton = document.getElementById('button_start') as HTMLButtonElement ;
		this.startButton.addEventListener('click', () => {
			this.start();
		});
	}

	public run() {

	}

	private async start() {
		if(this.vrtc) {
			return;
		}

		const vrtc = VVRTC.create({
			url: input_url.value,
		});

		this.vrtc = vrtc;

		vrtc.on(VVRTC.EVENT.USER_JOIN, ({userId}) => {
			console.log("user join", userId);
			const grid = addUserGrid(userId);
			this.users.set(userId, grid);

			initVideo(grid.video);
		});

		vrtc.on(VVRTC.EVENT.USER_LEAVE, ({userId}) => {
			console.log("user leave", userId);
			const grid = this.users.get(userId);
			if (grid) {
				removeUserGrid(grid);
			}

			// TODO: 取消订阅
		});

		vrtc.on(VVRTC.EVENT.USER_CAMERA_ON, ({userId}) => {
			console.log("user camera on", userId);
			const grid = this.users.get(userId)
			
			if (!grid) {
				return;
			}

			vrtc.watchUserCamera({
				userId,
				view: grid.video,
			});
		});

		vrtc.openCamera({
			view: this.sendPreview,
			publish: true,
		});

		await vrtc.joinRoom({
			userId: input_user.value,
			roomId: input_room.value,
		});
	}
}

function initVideo(view: HTMLVideoElement) {
	view.onloadedmetadata = () => {
		view.play();
	};
}


function addUserGrid(id: string): UserGrid {
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
		grid: gridItem,
	};
}

function removeUserGrid(grid: UserGrid) {
	
	grid.video.srcObject = null;

	const gridContainer = document.querySelector('.grid_container');
	if (gridContainer) {
		gridContainer.removeChild(grid.grid);
	}
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


const app = new App();
app.run();

