type userStatus = 'online' | 'offline' | 'inGame';
type userRoomStatus = 'normal' | 'mute';
type userRoomPower = 'owner' | 'admin' | 'member';

type userDto = {
	[key: number]: {
		userDisplayName: string;
		userProfileUrl: string;
		userStatus: 'online' | 'offline' | 'inGame';
	}
}
type userSimpleDto = {
	[key: number]: {
		blocked: boolean;
	}
}

type roomMessageDto = {
	userId: number;
	userName: string;
	message: string;
	isMe: boolean;
	number: number;
	date?: string;
}

type userInRoomListDto = {
	[key: number]: {
		userRoomStatus: 'normal' | 'mute';
		userRoomPower: 'owner' | 'admin' | 'member';
	}
}

type roomDetailDto = {
	userList: userInRoomListDto,
	messageList: roomMessageDto[],
	myRoomStatus: 'normal' | 'mute';
	myRoomPower: 'owner' | 'admin' | 'member';
}

type roomListDto = {
	[key: number]: {
		roomName: string
		roomType: 'open' | 'protected' | 'private' | 'dm';
		isJoined: boolean;
		detail?: roomDetailDto;
	}
}

type dmListDto = {
	[key: number]: {
		messageList: roomMessageDto[];
	}
}

export type { userDto, userSimpleDto, roomDetailDto, roomMessageDto, roomListDto, userInRoomListDto, userStatus, userRoomStatus, userRoomPower, dmListDto };
