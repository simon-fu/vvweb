/* eslint-disable no-console */

import { TreeOp, VideoType, VVRTC } from './vvrtc';
import { LogViewer } from "./log_viewer";

interface UserGrid {
	video: HTMLVideoElement;
	grid: HTMLDivElement;
	stateVideo: HTMLInputElement;
	stateAudio: HTMLInputElement;
	labelVideo: HTMLLabelElement;
	labelAudio: HTMLLabelElement;
	stateSmall: HTMLInputElement;
	labelSmall: HTMLLabelElement;
	labelVolume: HTMLLabelElement;
	overlay: HTMLDivElement;
	labelName: HTMLLabelElement;
	// layerSelect: HTMLSelectElement; 
}


interface User {
	grids: string[];
	ext?: string;
	treeKv: Map<string, string>;
}

class App {
	private startButton: HTMLButtonElement;
	private endButton: HTMLButtonElement;
	private sendPreview: HTMLVideoElement;
	private localCamera: HTMLInputElement;
	private localMic: HTMLInputElement;

	private vrtc: VVRTC;
	private grids: Map<string, UserGrid>;
	private users: Map<string, User>;
	private joined: boolean;
	private userExt?: string;
	private myTreeKv: Map<string, string>;

	public constructor() {
		this.grids = new Map;
		this.users = new Map;
		this.joined = false;
		this.myTreeKv = new Map;
		
		const vrtc = VVRTC.create({
			url: inputUrl.value,
		});

		this.vrtc = vrtc;

		this.sendPreview = document.querySelector('#preview-send') as HTMLVideoElement;
		initVideo(this.sendPreview);

		this.startButton = document.getElementById('button_start') as HTMLButtonElement ;
		this.startButton.addEventListener('click', async () => {
			if(!this.joined) {
				await this.start();
				this.joined = true;
				this.startButton.textContent = "离开房间"
				console.log("button started");
			} else {
				await this.stop();
				this.joined = false;
				this.startButton.textContent = "加入房间"
				localNameLabel.style.color = 'black';
				console.log("button stopped");
			}
		});

		this.endButton = document.getElementById('button_end') as HTMLButtonElement ;
		this.endButton.addEventListener('click', async () => {
			const updated = await this.vrtc.endRoom();
			if(updated) {
				logViewer.info("End room");
			}

			this.stop();
			this.joined = false;
			this.startButton.textContent = "加入房间"
			localNameLabel.style.color = 'black';
		});

		// textDialog.addEventListener('close', () => {
		// 	if (textDialog.returnValue === 'ok') {
		// 		const inputValue = dialogInputText.value;
		// 		console.log("用户输入:", inputValue);

		// 		this.userExt = inputValue;

		// 		if (!this.joined) {
					
		// 			makeLabelMyUsername(inputUserName.value, inputValue);
		// 		} else {
		// 			this.vrtc.updateUserExt(this.userExt);

		// 			const path = "user.foo";
		// 			const uvalue = inputValue ? "user-value" : undefined;
		// 			const rvalue = inputValue ? "room-value" : undefined;

		// 			if(uvalue) {
		// 				this.myTreeKv.set(path, uvalue);
		// 			} else {
		// 				this.myTreeKv.delete(path);
		// 			}
					
		// 			this.vrtc.updateUserTree(path, uvalue);
		// 			this.vrtc.updateRoomTree("room.bar", rvalue);

		// 			makeLabelMyUsername(inputUserName.value, this.userExt, this.myTreeKv);
		// 		}
				

		// 		if (!this.userExt) {
					
		// 		} else {
					
		// 		}
		// 	}
		// });

		
		userExtButton.addEventListener('click', async () => {
			this.vrtc.updateUserExt(userExtInput.value);
		});

		chatButton.addEventListener('click', async () => {

			const to = chatToSelect.value;
			const body = chatInput.value;

			if (!body) {
				return;
			}

			let sent = false;
			if(to) {
				sent = await this.vrtc.chatToUser(body, to);
			} else {
				sent = await this.vrtc.chatToRoom(body);
			}
			
			if (sent) {
				const sel = chatToSelect.selectedOptions.item(0)
				if (sel) {
					logViewer.info(`You say to ${sel.text}: [${body}]`);
				}
				chatInput.value = "";
			}
		});

		userTreeButton.addEventListener('click', async () => {
			this.vrtc.updateUserTree({
				path: userTreePathInput.value, 
				value: userTreeValueInput.value||undefined,
				prune: userTreePruneInput.checked,
			});
		});

		roomTreeButton.addEventListener('click', async () => {
			this.vrtc.updateRoomTree({
				path: roomTreePathInput.value, 
				value: roomTreeValueInput.value||undefined,
				prune: roomTreePruneInput.checked,
			});
		});
		

		// localNameLabel.ondblclick = () => {
		// 	dialogInputText.value = '';
		// 	dialogInputText.placeholder = 'User ext'
		// 	textDialog.showModal();
		// 	dialogInputText.focus();
		// };

		const shareButton = document.getElementById('button_share') as HTMLButtonElement ;
		shareButton.addEventListener('click', async () => {
			await this.vrtc.startLocalShareScreen();
		});

		this.localCamera = document.getElementById('local-camera') as HTMLInputElement ;
		this.localCamera.checked = cfgCameraOn;
		this.localCamera.addEventListener('click', () => {
			console.log("click local camera", this.localCamera.checked);

			if (this.localCamera.checked) {

				vrtc.openLocalCamera({
					view: this.sendPreview,
					small: inputLocalSmall.checked,
					constraints: {deviceId: videoSourceSelect.value ? {exact: videoSourceSelect.value} : undefined},
					codecName: cfgVideoCodecName,
				});
			} else {
				vrtc.closeLocalCamera();
			}
	
		});

		this.localMic = document.getElementById('local-mic') as HTMLInputElement ;
		this.localMic.checked = cfgMicOn;
		this.localMic.addEventListener('click', () => {
			console.log("click local mic", this.localMic.checked);

			vrtc.muteMic(!this.localMic.checked);

			if(this.localMic.checked) {
				if(!vrtc.isOpenMic()) {
					vrtc.openLocalMic({
						constraints: {
							echoCancellation: cfgEchoCancel, // TODO: 正式代码要开启回音消除
							deviceId: audioSourceSelect.value ? {exact: audioSourceSelect.value} : undefined
						},
					});
				}
			} else {
				if(!this.joined) {
					vrtc.closeLocalMic();
				}
			}
		});

		// vrtc.setMic({
		// 	constraints: {
        //         echoCancellation: cfgEchoCancel // TODO: 正式代码要开启回音消除
        //     },
		// })

		vrtc.on(VVRTC.EVENT.JOINED_ROOM, async (obj) => {
			console.log("on JOINED_ROOM: ", obj);
			logViewer.info(`Joined room [${obj.roomId}]`);
			localNameLabel.style.color = 'green';

			if (cfgRTrees) {
				cfgRTrees.forEach(op => {
					vrtc.updateRoomTree(op);
				});
			}

			{
				chatToSelect.innerHTML = '';
				const option = document.createElement('option');
				option.value = "";
				option.text = `Room[${obj.roomId}]`;
				chatToSelect.appendChild(option);
			}
		});

		vrtc.on(VVRTC.EVENT.ROOM_READY, async (obj) => {
			console.log("on ROOM_READY: ", obj);
			logViewer.info(`Room ready`);
			// logViewer.info(`Room ready [${obj.roomId}]`);
		});

		vrtc.on(VVRTC.EVENT.CLOSED, async (obj) => {
			console.log("on CLOSED: ", obj);
			const msg = JSON.stringify(obj);
			logViewer.error(`Closed. status [${msg}]`);
			await this.stop();
			this.joined = false;
			this.startButton.textContent = "加入房间"
			localNameLabel.style.color = 'black';
		});

		vrtc.on(VVRTC.EVENT.DISCONNECT, async (obj) => {
			console.log("on DISCONNECTED: ", obj);
			logViewer.error(`Disconnect. event [${obj}]`);
		});

		vrtc.on(VVRTC.EVENT.RECONN_SESSION, async (obj) => {
			console.log("on RECONN_SESSION: ", obj);
			logViewer.info(`Reconnect session. event [${JSON.stringify(obj)}]`);
		});

		vrtc.on(VVRTC.EVENT.USER_JOIN, ({userId, userExt, userTree}) => {
			console.log("on USER_JOIN: user", userId, ", ext", userExt, ", tree", userTree);
			const userTreeStr = JSON.stringify(userTree);
			logViewer.info(`Joined user [${userId}], ext [${userExt}], tree ${userTreeStr}`);

			const old = this.users.get(userId);

			const user: User = {
				grids: [],
				treeKv: new Map,
				ext: userExt,
			};

			this.users.set(userId, user);


			const gridId = userId;
			const grid = addUserGrid(gridId);
			this.grids.set(gridId, grid);
			user.grids.push(gridId);

			makeLabelUsername(grid.labelName, userId, undefined);

			if(userId === inputUserName.value) {
				grid.labelName.style.color = 'green';
			}

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

			if(!old) {
				// chatToSelect.innerHTML = '';
				const option = document.createElement('option');
				option.value = userId;
				option.text = `User[${userId}]`;
				chatToSelect.appendChild(option);
			}

		});

		vrtc.on(VVRTC.EVENT.USER_LEAVE, ({userId}) => {
			console.log("on USER_LEAVE: user", userId);

			const user = this.users.get(userId);
			if (!user) {
				return;
			}

			this.users.delete(userId);

			user.grids.forEach(gridId => {
				const grid = this.grids.get(gridId);
				if (grid) {
					this.grids.delete(gridId);
					removeUserGrid(grid);
				}
			});

			{
				for (let i = 0; i < chatToSelect.length; i++) {
					if (chatToSelect.options[i].value === userId) {
						chatToSelect.remove(i);
						break;
					}
				}
			}

			logViewer.info(`Leaved user [${userId}]`);
		});

		vrtc.on(VVRTC.EVENT.USER_EXT_CHANGED, ({userId, userExt}) => {
			console.log("on USER_EXT_CHANGED: user", userId, "ext", userExt);
			logViewer.info(`Ext changed, user [${userId}], ext [${userExt}]`);

			// const grid = this.grids.get(userId)
			
			// if (!grid) {
			// 	return;
			// }

			// const user = this.users.get(userId);
			// if (!user) {
			// 	return;
			// }

			// user.ext = userExt;
			// makeLabelUsername(grid.labelName, userId, user.ext, user.treeKv);
			
			
		});

		vrtc.on(VVRTC.EVENT.UPDATE_USER_TREE, ({userId, path, value, prune}) => {
			console.log("on UPDATE_USER_TREE: user", '[', userId, ']', "path", '[',path,']', "value", '[',value,']', "prune", '[',prune,']');
			logViewer.info(`Tree updated, user [${userId}], [${path}] -> [${value}], prune [${prune}]`);

			// const grid = this.grids.get(userId)
			// if (!grid) {
			// 	return;
			// }

			// const user = this.users.get(userId);
			// if (!user) {
			// 	return;
			// }

			// if (path) {
			// 	if (value) {
			// 		user.treeKv.set(path, value);
			// 	} else {
			// 		user.treeKv.delete(path);
			// 	}
			// } 

			// makeLabelUsername(grid.labelName, userId, user.ext, user.treeKv);
			
			
		});

		vrtc.on(VVRTC.EVENT.UPDATE_ROOM_TREE, ({roomId, path, value, prune}) => {
			console.log("on UPDATE_ROOM_TREE: room", '[', roomId, ']', "path", '[',path,']', "value", '[',value,']', "prune", '[',prune,']');
			logViewer.info(`Tree updated, room [${roomId}], [${path}] -> [${value}], prune [${prune}]`);
		});

		vrtc.on(VVRTC.EVENT.CHAT_ROOM, ({roomId, from, body}) => {
			console.log("on CHAT_ROOM: room", '[', roomId, ']', "from", '[',from,']', "body", '[',body,']');
			logViewer.info(`Chat from room [${roomId}], [${from}] say: [${body}]`);
		});

		vrtc.on(VVRTC.EVENT.CHAT_USER, ({from, body}) => {
			console.log("on CHAT_USER: ", "from", '[',from,']', "body", '[',body,']');
			logViewer.info(`Chat from user [${from}] say: [${body}]`);
		});
		

		vrtc.on(VVRTC.EVENT.USER_CAMERA_ON, ({userId}) => {
			console.log("on USER_CAMERA_ON: user", userId);
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
			console.log("on USER_CAMERA_OFF: user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}

			grid.labelVideo.style.color = '';
		});

		vrtc.on(VVRTC.EVENT.USER_SCREEN_ON, ({userId}) => {
			console.log("on USER_SCREEN_ON: user", userId);
			
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
			console.log("on USER_SCREEN_OFF: user", userId);
			
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
			console.log("on USER_MIC_ON: user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}
			
			grid.labelAudio.style.color = 'blue';
		});

		vrtc.on(VVRTC.EVENT.USER_MIC_OFF, ({userId}) => {
			console.log("on USER_MIC_OFF: user", userId);
			const grid = this.grids.get(userId)
			
			if (!grid) {
				return;
			}
			
			grid.labelAudio.style.color = '';
		});

		vrtc.enableTalkingUsers();
		vrtc.on(VVRTC.EVENT.TALKING_USERS, (result) => {
			// console.log("on TALKING_USERS: ", result);
			let text = '';
			result.users.forEach(userId => {
				if(userId === '') {
					text = `${text} me`
				} else {
					text = `${text} ${userId}`
				}
			});
			inputTalking.value = text;
		});

		vrtc.enableAudioVolume();
		vrtc.on(VVRTC.EVENT.AUDIO_VOLUME, (result) => {
			// console.log("on AUDIO_VOLUME: ", result);
			result.volumes.forEach(user => {
				if(user.userId === "") {
					localVolume.textContent = user.volume.toFixed(2);
				} else {
					const grid = this.grids.get(user.userId);
					if(grid) {
						grid.labelVolume.textContent = user.volume.toFixed(2);
					}
				}
			});
		});


		vrtc.enableStats();
		vrtc.on(VVRTC.EVENT.STATISTICS, (stats) => {
			// console.log("on STATISTICS: ", stats);
			const overlay = document.getElementById('statsOverlay');
			if (overlay) {
				let text = '';
				stats.localStatistics.video.forEach((report) => {
					text = `${text}V: ${report.width}x${report.height}/${report.frameRate} fps/${report.codecName}/${report.bitrate} Kbps\n`;
				});

				if (stats.localStatistics.audio) {
					const report = stats.localStatistics.audio;
					text = `${text}A: ${report.codecName}/${report.bitrate} Kbps\n`;
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
						texts[index] = `${texts[index]}V: ${report.width}x${report.height}/${report.frameRate} fps/${report.codecName}/${report.bitrate} Kbps\n`;
					});
				}

				{
					const report = remote.audio;
					if (report) {
						const grid = this.grids.get(remote.userId)
						if (grid) {
							texts[0] = `${texts[0]}A: ${report.codecName}/${report.bitrate} Kbps\n`
						}
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
		const roomId = inputRoomName.value;
		logViewer.debug(`Join room [${roomId}]...`);

		const vrtc = this.vrtc;

		// 退出后又加入要重新发布
		vrtc.muteMic(!this.localMic.checked);

		if (this.localCamera.checked) {

			vrtc.openLocalCamera({
				view: this.sendPreview,
				small: inputLocalSmall.checked,
				constraints: {deviceId: videoSourceSelect.value ? {exact: videoSourceSelect.value} : undefined},
				codecName: cfgVideoCodecName,
			});
		} else {
			vrtc.closeLocalCamera();
		}

		if (this.localMic.checked) {
			if(!vrtc.isOpenMic()) {
				vrtc.openLocalMic({
					constraints: {
						echoCancellation: cfgEchoCancel, // TODO: 正式代码要开启回音消除
						deviceId: audioSourceSelect.value ? {exact: audioSourceSelect.value} : undefined
					},
				});
			}
			
			// 测试发布音频的同时静音
			// vrtc.muteMic(true);
		} else {
			vrtc.closeLocalMic();
		}

		// const userExt = this.userExt; // "this_is_user_ext",
		const userExt = userExtInput.value;

		vrtc.joinRoom({
			userId: inputUserName.value,
			roomId,
			userExt,
			watchMe: cfgWatchMe,
			userTree: cfgUTrees,
			// userTree: [{
			// 	path: "foo.bar",
			// 	value: "abc",
			// }],
		});

		// const join_err = await vrtc.joinRoom({
		// 	userId: inputUserName.value,
		// 	roomId,
		// 	userExt: this.userExt, // "this_is_user_ext",
		// 	watchMe: cfgWatchMe,
		// });

		// if(!join_err) {
		// 	logViewer.info("Joined room");
		// } else {
		// 	console.warn("Join error", join_err);
		// 	// const msg = join_result.message;
		// 	// const name = join_result.name;
		// 	const err = join_err;
		// 	const msg = JSON.stringify(err);
		// 	logViewer.error(`Join error [${msg}]`);
		// }

		
	}

	private async stop() {
		const updated = await this.vrtc.leaveRoom();
		if(updated) {
			logViewer.info("Leaved room");
		}

		await this.clean();
	}

	private async clean() {
		this.grids.forEach(grid => {
			removeUserGrid(grid);
		});

		this.grids.clear();

		this.users.clear();

		this.myTreeKv.clear();
		makeLabelMyUsername(inputUserName.value, this.userExt);

		chatToSelect.innerHTML = '';
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
	const labelVolume = document.createElement('label');
		// <label >|  Volume </label>
		// <label id="local-volume">0.00</label>
	{	
		
		stateSmall.type = 'checkbox';
		stateContainer.appendChild(stateSmall);
		stateSmall.setAttribute('id', id + 'state-small');
		// stateSmall.hidden = true;
		// stateSmall.disabled = true;
		// stateSmall.checked = true;
		stateSmall.style.marginRight = '4px';

		{
			const label = labelSmall;
			stateContainer.appendChild(label);
			label.htmlFor = id + 'state-small';
			label.innerText = 'Small';
			// label.hidden = true;
			label.style.marginRight = '8px';
		}

		{
			const label = document.createElement('label');
			label.innerText = '|  Vol ';
			stateContainer.appendChild(label);

			stateContainer.appendChild(labelVolume);
		}

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
	
	const labelName = document.createElement('label');
	labelName.textContent = id;
	buttonContainer.appendChild(labelName);

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
		labelVolume,
		overlay,
		labelName,
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

const inputTalking = document.getElementById('input_talking') as HTMLInputElement;

const inputLocalSmall = document.getElementById('local-small') as HTMLInputElement ;
inputLocalSmall.checked = getQueryBool(urlParams, "small") ?? true;

const localVolume = document.getElementById('local-volume') as HTMLLabelElement ;

const videoSourceSelect = document.getElementById('videoSource') as HTMLSelectElement;
const audioSourceSelect = document.getElementById('audioSource') as HTMLSelectElement;
const audioOutputSelect = document.getElementById('audioOutput') as HTMLSelectElement;

const localNameLabel = document.getElementById('local-name') as HTMLLabelElement;
// localNameLabel.textContent = 'Me (' + inputUserName.value + ')'; 
makeLabelMyUsername(inputUserName.value);

function makeLabelMyUsername(userId: string, userExt?: string, extKv?: Map<string, string>) {
	if (userExt) {
		localNameLabel.textContent = 'Me (' + userId + ')' + '(' + userExt + ')'; 
	} else {
		localNameLabel.textContent = 'Me (' + userId + ')'; 
	}

	if (extKv && extKv.size > 0) {
		const str = JSON.stringify(Object.fromEntries(extKv));
		localNameLabel.textContent = localNameLabel.textContent + ' ' + str;
	}
}

function makeLabelUsername(label: HTMLLabelElement, userId: string, userExt?: string, extKv?: Map<string, string>) {
	if (userExt) {
		label.textContent = userId + '(' +  userExt + ')';
	} else {
		label.textContent = userId;
	}

	if (extKv && extKv.size > 0) {
		const str = JSON.stringify(Object.fromEntries(extKv));
		label.textContent = label.textContent + ' ' + str;
	}
}


const logViewer = new LogViewer("log_container", {
	filterLinesOnSearch: true,
	showTimestamp: true,
	height: "230px",
});


const cfgWatchMe = getQueryBool(urlParams, "watchMe") ?? true;
const cfgMicOn = getQueryBool(urlParams, "mic") ?? true;
const cfgCameraOn = getQueryBool(urlParams, "camera") ?? true; 
const cfgEchoCancel = getQueryBool(urlParams, "echoCancel") ?? true;
const cfgPrune = getQueryBool(urlParams, "prune") ?? true;
const cfgVideoCodecName = urlParams.get("vcodec") ?? undefined;
const cfgUTrees: TreeOp[]|undefined = parse_query_json<TreeOp[]>("utrees");
const cfgRTrees: TreeOp[]|undefined = parse_query_json<TreeOp[]>("rtrees");


function parse_query_json<T>(key: string) : T | undefined {
	const value = urlParams.get(key);
	try  {
		
		if (!value) {
			return undefined;	
		} 

		const parsed = JSON.parse(value) as T;

		logViewer.info(`query[${key}]=${value}`);

		return parsed;
	} catch (err) {
		logViewer.error(`wrong query [${key}] = [${value}]`);
		return undefined;
	}
}


const textaArgs = document.getElementById('texta_args') as HTMLTextAreaElement;
textaArgs.value = 
`ws - Websocket url, e.g. ws://127.0.0.1:11080/ws, wss://tt1.rtcsdk.com:11443/ws.
room - Room name.
user - User name, default random string.
watchMe - Enable watching myself, default true.
mic - Enable micphone, default true.
camera = Enable camera, default true.
echoCancel - Enable audio echo cancellation, default true.
small - Enable small video stream, default true.
prune - Enable prune when set user/room tree, default true.
vcodec- Prefer video codec, e.g. vp8, vp9, h264.
utrees - Inital user tree array, e.g. [{"path":"query.k1","value":"qk1"}].
rtrees - Inital user tree array, see utrees.
`;


function getQueryBool(params: URLSearchParams, key: string): boolean | undefined {
//   const params = new URLSearchParams(window.location.search);
  const value = params.get(key);

  if (value === null) return undefined; // 参数不存在
  if (value === '' || value.toLowerCase() === 'true' || value === '1') return true;
  if (value.toLowerCase() === 'false' || value === '0') return false;

  return undefined; // 不可识别的值
}


// const dialogInputText = document.getElementById('dialogInputText') as HTMLInputElement;
// const textDialog = document.getElementById('textDialog') as HTMLDialogElement;

const userExtButton = document.getElementById('button_user_ext') as HTMLButtonElement;
const userExtInput = document.getElementById('input_user_ext') as HTMLInputElement;

const chatButton = document.getElementById('button_chat') as HTMLButtonElement;
const chatInput = document.getElementById('input_chat') as HTMLInputElement;
const chatToSelect = document.getElementById('chatTo') as HTMLSelectElement;

const userTreeButton = document.getElementById('button_user_tree') as HTMLButtonElement;
const userTreePathInput = document.getElementById('input_user_tree_path') as HTMLInputElement;
const userTreeValueInput = document.getElementById('input_user_tree_value') as HTMLInputElement;

const roomTreeButton = document.getElementById('button_room_tree') as HTMLButtonElement;
const roomTreePathInput = document.getElementById('input_room_tree_path') as HTMLInputElement;
const roomTreeValueInput = document.getElementById('input_room_tree_value') as HTMLInputElement;

const userTreePruneInput = document.getElementById('checkbox_user_tree_prune') as HTMLInputElement ;
userTreePruneInput.checked = cfgPrune;

const roomTreePruneInput = document.getElementById('checkbox_room_tree_prune') as HTMLInputElement ;
roomTreePruneInput.checked = cfgPrune;


window.addEventListener('error', e => console.log('window error', e));
window.addEventListener('unhandledrejection', e => console.log('unhandled rejection', e.reason));




async function getDeviceList(): Promise<MediaDeviceInfo[]> {
	if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
		throw new Error('浏览器不支持 mediaDevices.enumerateDevices');
	}

	// 尝试请求媒体权限以便获取 device.label（如果用户拒绝则继续返回列表但 label 可能为空）
	try {
		// 只请求音频许可通常就能解锁大多数设备的 label；如果也需要摄像头名，同时请求 video: true
		// 你可以在这里改成 { audio: true } 或 { video: true } 按需
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
		// 立即停止获取到的流，避免占用设备
		stream.getTracks().forEach(t => t.stop());
	} catch (err) {
		// 用户可能拒绝权限；这不是致命错误，但 label 可能为空
		console.warn('getUserMedia 访问被拒绝或失败，设备 label 可能为空', err);
	}

	const devices = await navigator.mediaDevices.enumerateDevices();
	return devices;
}


function initSelect(select: HTMLSelectElement, devices: MediaDeviceInfo[]) {
	select.innerHTML = '';
	for (const device of devices) {
		const option = document.createElement('option');
		option.value = device.deviceId;
		// 如果 label 为空则显示 kind + deviceId 的前短串作为占位
		option.text = device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`;
		select.appendChild(option);
	}
}

async function initDeviceList() {
	
	try {
		const devices = await getDeviceList();
		console.log('全部设备:', devices);

		// const { audioInputs, audioOutputs, videoInputs } = separateDevices(devices);
		const { audioInputs, audioOutputs, videoInputs } = {
			audioInputs: devices.filter(d => d.kind === 'audioinput'),
			audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
			videoInputs: devices.filter(d => d.kind === 'videoinput'),
		};

		console.log('麦克风:', audioInputs);
		console.log('扬声器:', audioOutputs);
		console.log('摄像头:', videoInputs);

		initSelect(videoSourceSelect, videoInputs);
		initSelect(audioSourceSelect, audioInputs);
		initSelect(audioOutputSelect, audioOutputs);

	} catch (err) {
		console.error('获取设备列表失败:', err);
	}
}

let enableDevices = false;
document.addEventListener('DOMContentLoaded', () => {
	{
		const details = document.getElementById('devicesDetails') as HTMLDetailsElement;
		details.addEventListener('toggle', () => {
			if (details.open) {
				if(!enableDevices) {
					enableDevices = true;
					initDeviceList();
				}
			} 
		});
	}

	// 当系统插拔设备时自动更新
	if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
		navigator.mediaDevices.addEventListener('devicechange', () => {
			if(enableDevices) {
				console.log('设备发生变化，重新获取列表');
				initDeviceList();
			}
		});
	}

	const app = new App();
	app.run();
});




