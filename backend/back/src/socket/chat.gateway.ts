import { Logger, UnauthorizedException } from "@nestjs/common";
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import { AuthService } from "src/auth/auth.service";
import { User } from "src/database/entity/user.entity";
import { UserBlock } from "src/database/entity/user-block.entity";
import { UserService } from "src/user/user.service";

type roomType = 'open' | 'protected' | 'private';
type userStatus = 'online' | 'offline' | 'inGame';
type userRoomStatus = 'normal' | 'mute' | 'ban' | 'kick';
type userRoomPower = 'owner' | 'admin' | 'member';

interface ClientUserDto {
	userDisplayName: string;
	userProfileUrl: string;
	userStatus: userStatus;
}

type ClientRoomListDto = {
	roomName: string
	roomType: 'open' | 'protected' | 'private';
}

interface UserInfo {
	socket: Socket;
	status: userStatus;
	blockedUsers: number[];
}

interface RoomMember {
	userRoomStatus: userRoomStatus;
	userRoomPower: userRoomPower;
}

interface RoomInfo {
	roomNumber: number;
	roomName: string;
	roomType: roomType;
	roomMembers: Record<number, RoomMember>;
	roomOwner: number;
	roomAdmins: number[];
	bannedUsers: number[];
	roomPass?: string;
}

const userList: Record<number, UserInfo> = {};
const roomList: Record<number, RoomInfo> = {};
let ROOM_NUMBER = 1;

@WebSocketGateway({ namespace: "sock", cors: { origin: "*" } })
export class EventsGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	constructor(
		private userService: UserService,
		private authService: AuthService
	) { }

	private logger = new Logger("Gateway");

	@WebSocketServer()
	nsp: Namespace;

	afterInit() {
		this.nsp.emit("room-clear");
		this.logger.log("socket initialized");
	}

	async handleConnection(@ConnectedSocket() socket: Socket) {
		try {
			this.logger.log(`\n\n${socket.id} socket connected.`);
			const uid = await this.authService.jwtVerify(socket.handshake.auth.token);
			const user = await this.userService.getUserByUid(uid);
			if (this.userService.isUserExist(user)) {
				socket.data.user = user;
				if (userList[uid] === undefined) {
					userList[uid] = {
						socket: socket,
						status: 'online',
						blockedUsers: []
					};
					try { // TODO: check
						console.log(user?.blockedUsers.map((blockedUsers) => blockedUsers.targetToBlockId));
					} catch (e) {
						console.log("blockedUsers is undefined");
					}
					this.logger.log(`${socket.data.user.nickname} connected.`);
				}
			} else {
				throw new UnauthorizedException("User not found.");
			}
		} catch (e) {
			this.logger.log(`${socket.id} invalid connection. disconnect socket.`);
			socket.disconnect();
		}
	}

	handleDisconnect(@ConnectedSocket() socket: Socket) {
		this.logger.log(`${socket.id} socket disconnected`);
	}

	@SubscribeMessage("test")
	handleTest(
		@MessageBody() { message }: { message: string }
	) {
		console.log(`fromClient: ${message}`);
		return { fromServer: message };
	}

	@SubscribeMessage("room-create")
	handleRoomCreate(
		@ConnectedSocket() socket: Socket,
		@MessageBody() {
			roomName,
			roomType,
			roomPass,
		}: {
			roomName: string;
			roomType: roomType;
			roomPass?: string;
		}) {
		const trimmedRoomName = roomName.trim();
		if (trimmedRoomName.length > 0 && trimmedRoomName.length <= 12) {
			const newMember: RoomMember = {
				userRoomStatus: 'normal',
				userRoomPower: 'owner',
			};
			const roomMembers: Record<number, RoomMember> = {};
			roomMembers[socket.data.user.uid] = newMember;
			const newRoom: RoomInfo = {
				roomNumber: ROOM_NUMBER,
				roomName: trimmedRoomName,
				roomType: roomType,
				roomMembers: roomMembers,
				roomOwner: socket.data.user.uid,
				roomAdmins: [],
				bannedUsers: [],
				roomPass: roomPass, // TODO : 암호화
			}
			roomList[ROOM_NUMBER] = newRoom;
			socket.join(ROOM_NUMBER.toString());
			if (roomType !== 'private') {
				this.EmitRoomListNotify(socket, { action: 'add', roomId: ROOM_NUMBER, roomName: trimmedRoomName, roomType });
			}
			this.EmitRoomJoin(socket, { roomId: ROOM_NUMBER, roomName: trimmedRoomName, roomType, roomMembers, myPower: 'owner', status: 'ok' });
			ROOM_NUMBER++;
			console.log(roomList);
		} else {
			return { status: 'ko' };
		}
		return { status: 'ok' };
	}

	@SubscribeMessage("room-list")
	handleRoomList(@ConnectedSocket() socket: Socket) {
		const tempRoomList: Record<number, ClientRoomListDto> = {};
		for (const [roomId, roomInfo] of Object.entries(roomList)) {
			if (roomInfo.roomType !== 'private') {
				tempRoomList[roomId] = {
					roomName: roomInfo.roomName,
					roomType: roomInfo.roomType,
				};
			}
		}
		return { roomList: tempRoomList };
	}

	@SubscribeMessage("user-list")
	handleUserList(@ConnectedSocket() socket: Socket) {
		const tempUserList: Record<number, ClientUserDto> = {};
		for (const [uid, userInfo] of Object.entries(userList)) {
			tempUserList[uid] = {
				userDisplayName: userInfo.socket.data.user.nickname.split('#', 2)[0],
				userProfileUrl: userInfo.socket.data.user.profileUrl,
				userStatus: userInfo.status,
			};
		}
		return { userListFromServer: tempUserList };
	}

	EmitRoomJoin(socket: Socket, {
		roomId,
		roomName,
		roomType,
		roomMembers,
		myPower,
		status
	}) {
		this.nsp.to(socket.id).emit("room-join", {
			roomId,
			roomName,
			roomType,
			userList: roomMembers,
			myPower,
			status,
		})
	}

	EmitRoomListNotify(socket: Socket, {
		action,
		roomId,
		roomName,
		roomType,
	}) {
		this.nsp.emit("room-list-notify", {
			action,
			roomId,
			roomName,
			roomType,
		})
	}

	EmitUserUpdate(socket: Socket) {
		socket.broadcast.emit("user-update", {
			userId: socket.data.user.uid,
			userDisplayName: socket.data.user.nickname.split('#', 2)[0],
			userProfileUrl: socket.data.user.profileUrl,
			userStatus: userList[socket.data.user.uid].status,
		});
	}

}
