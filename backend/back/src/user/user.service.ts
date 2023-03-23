import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import config from 'config';
import { IntraTokenDto } from "./dto/IntraTokenDto";
import { IntraUserDto } from "./dto/IntraUserDto";
import { User } from "./user.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
// import { UserRepository } from "./user.repository";

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User)
		private userRepository: Repository<User>,
		private jwtService: JwtService,
	){}

	async getTokenFromIntra(code: string) : Promise<IntraTokenDto> {
		const intraConfig : any = config.get('intra');
		const clientId = intraConfig.client_id;
		const clientSecret = intraConfig.client_secret;
		const redirect_uri = intraConfig.redirect_uri;
		const url = intraConfig.url;

		const params = new URLSearchParams();
		params.set('grant_type', 'authorization_code');
		params.set('client_id', clientId); 
		params.set('client_secret',clientSecret);
		params.set('code', code);
		params.set('redirect_uri',redirect_uri);

		const response = await fetch(url, {
			method: 'POST',
			body: params
		});

		const intraToken : IntraTokenDto = await response.json();
		if (response.status < 200 || response.status >= 300) {
			Logger.log(`${response}`);
			Logger.log(`${response.status}`);
			throw (`HTTP error! status: ${response.status}`);
		}
		return intraToken;	
	}
	
	async getUserInfoFromIntra(tokenObject: IntraTokenDto): Promise<IntraUserDto>{
		const meUrl = 'https://api.intra.42.fr/v2/me';
		const response = await fetch(meUrl, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${tokenObject.access_token}`,
			},
		});
		if (response.status < 200 || response.status >= 300) {
			Logger.log(`${response}`);
			Logger.log(`${response.status}`);
			throw (`HTTP error! status: ${response.status}`);
		}
		const intraUserInfo: IntraUserDto = await response.json();
		return intraUserInfo;
	}

	async addNewUser(intraUserDto: IntraUserDto): Promise<string>{
		const payload = {uuid : intraUserDto.id};
		const accessToken : string = await this.jwtService.sign(payload);
		const user: User = await User.fromIntraUserDto(intraUserDto);
		user.token = accessToken;
		await this.userRepository.save(user);
		return accessToken;
	}
	async getUserById(uid: number) {
		const user = await this.userRepository.findOneBy({uid});
		return user;
	}

}