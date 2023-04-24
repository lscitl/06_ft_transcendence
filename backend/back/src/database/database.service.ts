import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserFollow } from "src/database/entity/user-follow.entity";
import { User } from "src/database/entity/user.entity";
import { DataSource, Repository } from "typeorm";
import { Game } from "./entity/game.entity";
import { UserBlock } from "./entity/user-block.entity";

@Injectable()
export class DatabaseService {
    constructor(
        @InjectRepository(User) private userRepository: Repository<User>,
        @InjectRepository(UserFollow) private userFollowRepository: Repository<UserFollow>,
        @InjectRepository(UserBlock) private userBlockRepository: Repository<UserBlock>,
        @InjectRepository(Game) private gameRepository: Repository<Game>,
        private dataSource: DataSource,
    ) {}

    //USER CREATE
    async saveUser(user: User): Promise<User>{
        return await this.userRepository.save(user);
    }
    
    // USER READ
    async findAllUser(): Promise<User[]>{
        return await this.userRepository.find();
    }
    // THIS MIGHT NOT WORK
    async findAllUsersWithGames(): Promise<User[]> {
        const users = await this.userRepository.find({ relations: ["wonGames", "lostGames", "followers", "followings"] });
        return users;
    }
    
    async findUserByUid(uid: number): Promise<User | null>{
        const user = await this.userRepository.findOneBy({uid});
        return user;
    }
    
    async findUserByNickname(nickname: string): Promise<User | null> {
		const user = await this.userRepository.findOneBy({nickname});
		return user;
    }

    async findUserByEmail(email: string): Promise<User | null>{
        const user = await this.userRepository.findOneBy({email});
		return user;
    }


    // USER UPDATE
    async updateUser(user: User){
        await this.userRepository.save(user);
    }
    
    async updateUserNickname(uid: number, nickname: string){
        try{
            await this.userRepository.update({uid}, {nickname});
        } catch (error) {
            throw new ForbiddenException('nickname already exists');
        }
    }

    async updateUserRefreshToken(uid: number, refreshToken: string | null){
        try {
            await this.userRepository.update({uid},{refreshToken});
        } catch (error){
            throw new BadRequestException(`refreshTokenUpdate Error + ${error}`);
        }
    }

    async updateUserPassword(uid: number, password: string){
        await this.userRepository.update({uid}, {password});
    }

    async updateUserProfileImgUrl(uid: number, profileUrl: string ){
        await this.userRepository.update({uid}, {profileUrl});
    }

    async updateUserTwoFactorEnabled(uid: number,  twoFactorEnabled: boolean){
        await this.userRepository.update({uid}, {twoFactorEnabled});
    }
    async updateUserTwoSecret(uid: number,  twoFactorSecret: string){
        await this.userRepository.update({uid}, {twoFactorSecret});
    }


    // USER DELETE
    async deleteUser(uid: number){
        return await this.userRepository.delete({uid});
    }



    // USER-FOLLOW CREATE
    async saveFollow(userFollow: UserFollow): Promise<UserFollow>{
        return await this.userFollowRepository.save(userFollow);
    }
    
    // USER-FOLLOW READ
    async findFollowingByUid(fromUid: number, toUid: number): Promise<UserFollow | null>{
        return await this.userFollowRepository.findOne({ where : { fromUserId: fromUid, targetToFollowId: toUid } });
    }
    
    // USER-FOLLOW UPDATE
    
    
    // USER-FOLLOW DELETE
    async deleteFollow(fromUid: number, toUid: number) {
        // await this.userFollowRepository.remove(userFollow);
        const result = await this.userFollowRepository.delete({fromUserId: fromUid, targetToFollowId: toUid});
        if (result.affected === 0) {
            throw new NotFoundException("already unfollowed");
        }
    }
    
    // USER-BLOCK CREATE
    async saveBlock(userBlock: UserBlock): Promise<UserBlock> {
        return await this.userBlockRepository.save(userBlock);
    }
    
    // USER-BLOCK READ
    async findBlockByUid(fromUid: number, toUid: number): Promise<UserBlock | null> {
        return await this.userBlockRepository.findOne({ where: { fromUserId: fromUid, targetToBlockId: toUid } });
    }

    // USER-BLOCK DELETE
    async deleteBlock(fromUid: number, toUid: number) {
        // await this.userBlockRepository.remove(userBlock);
        const result = await this.userBlockRepository.delete({fromUserId: fromUid, targetToBlockId: toUid});
        if (result.affected === 0) {
            throw new NotFoundException("already unblocked");
        }
    }
    
    //GAME
    
}