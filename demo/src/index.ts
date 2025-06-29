/* eslint-disable no-console */

import { VideoType, VVRTC } from './vvrtc';

interface UserGrid {
	video: HTMLVideoElement;
	grid: HTMLDivElement;
	stateVideo: HTMLInputElement;
	stateAudio: HTMLInputElement;
	labelVideo: HTMLLabelElement;
	labelAudio: HTMLLabelElement;
	stateSmall: HTMLInputElement;
	labelSmall: HTMLLabelElement;
	overlay: HTMLDivElement;
	// layerSelect: HTMLSelectElement; 
}


interface User {
	grids: string[];
}

class App {
	private startButton: HTMLButtonElement;
	private sendPreview: HTMLVideoElement;
	private localCamera: HTMLInputElement;
	private localMic: HTMLInputElement;

	private vrtc: VVRTC;
	private grids: Map<string, UserGrid>;
	private users: Map<string, User>;
	private joined: boolean;

	public constructor() {
		this.grids = new Map;
		this.users = new Map;
		this.joined = false;
		
		const vrtc = VVRTC.create({
			url: inputUrl.value,
		});

		this.vrtc = vrtc;

		this.sendPreview = document.querySelector('#preview-send') as HTMLVideoElement;
		initVideo(this.sendPreview);

		this.startButton = document.getElementById('button_start') as HTMLButtonElement ;
		this.startButton.addEventListener('click', () => {
			if(!this.joined) {
				this.start();
				this.joined = true;
				this.startButton.textContent = "离开房间"
			} else {
				this.stop();
				this.joined = false;
				this.startButton.textContent = "加入房间"
			}
		});

		const shareButton = document.getElementById('button_share') as HTMLButtonElement ;
		shareButton.addEventListener('click', async () => {
			await this.vrtc.startLocalShareScreen();
		});

		this.localCamera = document.getElementById('local-camera') as HTMLInputElement ;
		this.localCamera.addEventListener('click', () => {
			console.log("click local camera", this.localCamera.checked);

			if (this.localCamera.checked) {
				const localSmall = document.getElementById('local-small') as HTMLInputElement ;

				vrtc.openLocalCamera({
					view: this.sendPreview,
					publish: true,
					small: localSmall.checked,
				});
			} else {
				vrtc.closeLocalCamera();
			}
	
		});

		this.localMic = document.getElementById('local-mic') as HTMLInputElement ;
		this.localMic.addEventListener('click', () => {
			console.log("click local mic", this.localMic.checked);

			vrtc.muteMic(!this.localMic.checked);
		});

		vrtc.setMic({
			constraints: {
                echoCancellation: false // TODO: 正式代码要开启回音消除
            },
		})

		vrtc.on(VVRTC.EVENT.USER_JOIN, ({userId, userExt}) => {
			console.log("joined user", userId, ", ext", userExt);
			
			const user: User = {
				grids: [],
			};

			this.users.set(userId, user);


			const gridId = userId;
			const grid = addUserGrid(gridId);
			this.grids.set(gridId, grid);
			user.grids.push(gridId);

			initVideo(grid.video);
			
			grid.stateVideo.addEventListener('click', () => {
				const small = grid.stateSmall.checked? true : undefined;
				console.log("click remote video, user", userId, "checked", grid.stateVideo.checked, "small", small);
	
				if (grid.stateVideo.checked) {
					vrtc.watchRemoteCamera({
						userId,
						view: grid.video,
						option: {
							small,
						}
					});
				} else {
					vrtc.unwatchRemoteCamera(userId);
				}
				
			});

			// grid.layerSelect.addEventListener('change', (evt) => {
			// 	const sel = evt.target as HTMLSelectElement;
			// 	const [layerS, layerT] = sel.value.split(',').map(Number); // 解析回数组
			// 	console.log('selected layer', layerS, layerT);
			// });

			grid.stateSmall.addEventListener('click', () => {
				const small = grid.stateSmall.checked? true : undefined;
				this.vrtc.updateRemoteCamera({
					userId,
					option:{small}
				})
			});

		});

		vrtc.on(VVRTC.EVENT.USER_LEAVE, ({userId}) => {
			console.log("leaved user", userId);
			const user = this.users.get(userId);
			if (!user) {
				return;
			}

			user.grids.forEach(gridId => {
				const grid = this.grids.get(gridId);
				if (grid) {
					this.grids.delete(gridId);
					removeUserGrid(grid);
				}
			});

		});

		vrtc.on(VVRTC.EVENT.USER_CAMERA_ON, ({userId}) => {
			console.log("switch camera on, user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}

			grid.labelVideo.style.color = 'blue';
			const small = grid.stateSmall.checked? true : undefined;

			if (grid.stateVideo.checked) {
				vrtc.watchRemoteCamera({
					userId,
					view: grid.video,
					option: {
						small,
					}
				});
			}
		});

		vrtc.on(VVRTC.EVENT.USER_CAMERA_OFF, ({userId}) => {
			console.log("switch camera off, user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}

			grid.labelVideo.style.color = '';
		});

		vrtc.on(VVRTC.EVENT.USER_SCREEN_ON, ({userId}) => {
			console.log("switch screen on, user", userId);
			
			const user = this.users.get(userId);
			if(!user) {
				return;
			}


			const gridId = userId + '_screen';
			const grid = addUserGrid(gridId);
			this.grids.set(gridId, grid);
			user.grids.push(gridId);

			initVideo(grid.video);

			vrtc.watchUserScreen({
				userId,
				view: grid.video,
			});
		});

		vrtc.on(VVRTC.EVENT.USER_SCREEN_OFF, ({userId}) => {
			console.log("switch screen off, user", userId);
			
			const user = this.users.get(userId);
			if(!user) {
				return;
			}

			const gridId = userId + '_screen';
			const grid = this.grids.get(gridId);
			if (grid) {
				this.grids.delete(gridId);
				user.grids = user.grids.filter(item => item !== gridId);
				removeUserGrid(grid);
			}
		});

		vrtc.on(VVRTC.EVENT.USER_MIC_ON, ({userId}) => {
			console.log("switch mic on, user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}
			
			grid.labelAudio.style.color = 'blue';
		});

		vrtc.on(VVRTC.EVENT.USER_MIC_OFF, ({userId}) => {
			console.log("on switch mic off, user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}
			
			grid.labelAudio.style.color = '';
		});

		vrtc.on(VVRTC.EVENT.STATISTICS, (stats) => {
			// console.log("event stats", stats);
			const overlay = document.getElementById('statsOverlay');
			if (overlay) {
				let text = '';
				stats.localStatistics.video.forEach((report) => {
					text = `${text}V: ${report.width}x${report.height}/${report.frameRate} fps/${report.bitrate} Kbps\n`;
				});

				if (stats.localStatistics.audio) {
					text = `${text}A: ${stats.localStatistics.audio.bitrate} Kbps\n`;
				}
				
				overlay.textContent = text;
			}

			stats.remoteStatistics.forEach(remote => {
				// texts[0] - main
				// texts[1] - screen
				let texts = ['', '']; 

				const video = remote.video;
				if (video) {
					// console.log("remote user video statistics ", video);

					video.forEach((report) => {
						let index: number;
						switch (report.videoType) {
							case VideoType.Camera: index = 0; break;
							case VideoType.Screen: index = 1; break;
						}
						texts[index] = `${texts[index]}V: ${report.width}x${report.height}/${report.frameRate} fps/${report.bitrate} Kbps\n`;
					});
				}

				const audio = remote.audio;
				if (audio) {
					const grid = this.grids.get(remote.userId)
					if (grid) {
						texts[0] = `${texts[0]}A: ${audio.bitrate} Kbps\n`
					}
				}

				if (texts[0].length > 0) {
					const grid = this.grids.get(remote.userId)
					if (grid) {
						grid.overlay.textContent = texts[0];
					}
				}

				if (texts[1].length > 0) {
					const gridId = remote.userId + '_screen';
					const grid = this.grids.get(gridId)
					if (grid) {
						grid.overlay.textContent = texts[1];
					}
				}

				// const grid = this.grids.get(remote.userId)
				// if (grid) {
				// 	if (remote.video) {
				// 		let text = '';
				// 		remote.video.forEach((report) => {
				// 			text = `${text}${report.width}x${report.height}/${report.frameRate}fps/${report.bitrate}Kbps\n`;
				// 		});
						
				// 		grid.overlay.textContent = text;
				// 		// console.log("remote user stats", remote.userId, "text", text);
				// 	}
				// }
			});
		});
	}

	public run() {

	}

	private async start() {

		const vrtc = this.vrtc;

		await vrtc.joinRoom({
			userId: inputUserName.value,
			roomId: inputRoomName.value,
			userExt: "this_is_user_ext",
		});

		// 退出后又加入要重新发布
		vrtc.muteMic(!this.localMic.checked);

		if (this.localCamera.checked) {
			const localSmall = document.getElementById('local-small') as HTMLInputElement ;

			vrtc.openLocalCamera({
				view: this.sendPreview,
				publish: true,
				small: localSmall.checked,
			});
		} else {
			vrtc.closeLocalCamera();
		}
	}

	private async stop() {
		await this.vrtc.leaveRoom();
		await this.clean();
	}

	private async clean() {
		this.grids.forEach(grid => {
			removeUserGrid(grid);
		});

		this.grids.clear();
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
	videoContainer.style.position = 'relative';
	videoContainer.style.display = 'inline-block';

	const video = document.createElement('video');
	video.setAttribute('muted', '');
	video.setAttribute('controls', '');
	// 可为新 video 元素设置动态 id
	// video.id = 'preview-receive-' + Date.now();
	videoContainer.appendChild(video);

	const overlay = document.createElement('div');
	// overlay.style = "position:absolute; top:8px; left:8px; color:#fff; background:rgba(0,0,0,0.5); padding:4px 8px; border-radius:4px; font-size:12px; white-space: pre-wrap;";
	overlay.style.position = 'absolute';
	overlay.style.top = '8px';
	overlay.style.left = '8px';
	overlay.style.color = '#fff';
	overlay.style.background = 'rgba(0,0,0,0.5)';
	overlay.style.padding = '4px 8px';
	overlay.style.borderRadius = '4px';
	overlay.style.fontSize = '12px';
	overlay.style.whiteSpace = 'pre-wrap';
	videoContainer.appendChild(overlay);

	const stateContainer = document.createElement('div');

	const stateAudio = document.createElement('input');
	const labelAudio = document.createElement('label');
	{	
		
		stateAudio.type = 'checkbox';
		stateContainer.appendChild(stateAudio);
		stateAudio.setAttribute('id', id + 'state-audio');
		// stateAudio.hidden = true;
		stateAudio.disabled = true;
		stateAudio.checked = true;
		stateAudio.style.marginRight = '4px';

		const label = labelAudio;
		stateContainer.appendChild(label);
		label.htmlFor = id + 'state-audio';
		label.innerText = 'Audio';
		// label.hidden = true;
		label.style.marginRight = '8px';
	}


	const stateVideo = document.createElement('input');
	const labelVideo = document.createElement('label');
	{	
		
		stateVideo.type = 'checkbox';
		stateContainer.appendChild(stateVideo);
		stateVideo.setAttribute('id', id + 'state-video');
		// stateVideo.hidden = true;
		// stateVideo.disabled = true;
		stateVideo.checked = true;
		stateVideo.style.marginRight = '4px';

		const label = labelVideo;
		stateContainer.appendChild(label);
		label.htmlFor = id + 'state-video';
		label.innerText = 'Video';
		// label.hidden = true;
		label.style.marginRight = '8px';
	}
	

	const stateSmall = document.createElement('input');
	const labelSmall = document.createElement('label');
	{	
		
		stateSmall.type = 'checkbox';
		stateContainer.appendChild(stateSmall);
		stateSmall.setAttribute('id', id + 'state-small');
		// stateSmall.hidden = true;
		// stateSmall.disabled = true;
		// stateSmall.checked = true;
		stateSmall.style.marginRight = '4px';

		const label = labelSmall;
		stateContainer.appendChild(label);
		label.htmlFor = id + 'state-small';
		label.innerText = 'Small';
		// label.hidden = true;
		label.style.marginRight = '8px';
	}

	// const layerSelect = document.createElement("select");
	// {
	// 	let value = '';
	// 	for (let si = 0; si <= 2; si++) {
	// 		for (let ti = 0; ti <= 2; ti++) {
	// 		  const text = `S${si}T${ti}`;
	// 		  value = `${si},${ti}`;
	// 		  const option = document.createElement('option');
	// 		  option.value = value;
	// 		  option.text = text;
	// 		  layerSelect.appendChild(option);
	// 		}
	// 	}
	// 	layerSelect.value = value;

	// 	stateContainer.appendChild(layerSelect);
	// }


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
	gridItem.appendChild(stateContainer);

	// 将新创建的 grid_item 添加到 grid_container 中
	const gridContainer = document.querySelector('.grid_container');
	
	if (gridContainer) {
		gridContainer.appendChild(gridItem);
	}

	return {
		video,
		grid: gridItem,
		stateAudio,
		stateVideo,
		labelAudio,
		labelVideo,
		stateSmall,
		labelSmall,
		overlay,
		// layerSelect,
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

const urlParams = new URLSearchParams(window.location.search);

const URL = "ws://127.0.0.1:11080/ws";

const inputUrl = document.getElementById('input_url') as HTMLInputElement;
if (inputUrl) {
	inputUrl.value = urlParams.get("ws") ?? URL ;
}

const ROOM = "room01";
const inputRoomName = document.getElementById('input_room') as HTMLInputElement;
if (inputRoomName) {
	inputRoomName.value = urlParams.get("room") ?? ROOM;
}

// const USER = "user01";
const inputUserName = document.getElementById('input_user') as HTMLInputElement;
if (inputUserName) {
	inputUserName.value = urlParams.get("user") ?? generateRandomString(6);
}


const app = new App();
app.run();

