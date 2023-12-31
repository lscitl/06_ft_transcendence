import { Injectable, Logger } from "@nestjs/common";
import { Namespace } from "socket.io";
import { DatabaseService } from "src/database/database.service";
import { User } from "src/database/entity/user.entity";
import { Game as GameEntity } from "../database/entity/game.entity";
import { Direction, GameMode, GameStatus, GameType, Hit } from "./game.enum";
import { GameInfo } from "./game.gateway";

interface GameCoords {
  paddle1Y: number,
  ballX: number,
  ballY: number,
  paddle2Y: number,
  ballSpeedX: number,
  ballSpeedY: number,
  paddleSpeed: number,
  keyPress: number[],
  time: number,
}

export interface GameStartVar {
  gameId: string,
  server: Namespace,
  p1: User,
  p2: User,
  gameType: GameType,
}

@Injectable()
export class GameService {
  private games: Map<string, Game>;
  constructor(private readonly databaseService: DatabaseService) {
    this.games = new Map<string, Game>();
  }
  
  createGame(gv: GameStartVar) {
    try {
      const curGame = new Game(gv, this.databaseService, this.games);
      this.games.set(gv.gameId, curGame);
      curGame.gameStart();
      console.log(`${gv.gameId} game started!!!!`);
    } catch (e) {
      Logger.error("Fail to create game.");
    }
  }

  getGame(gameId: string) {
    return this.games.get(gameId);
  }

  deleteGame(gameId: string) {
    this.games.delete(gameId);
  }

  gameState(gameId: string) {
    const game = this.games.get(gameId);
    if (game !== undefined) {
      return game.getStatus();
    }
    return GameStatus.FINISHED;
  }
}

class Game {
  private ballSpeedX: number;
  private ballSpeedY: number;
  private ballX: number;
  private ballY: number;
  private paddle1Y: number;
  private paddle2Y: number;
  private paddleSpeed: number;
  private paddleSpeedMax: number;
  private gameStatus: GameStatus;
  private round: number;
  
  private gameMode: GameMode;

  private roundStartTime: number;
  private lastUpdate: number;
  private lastUpdateCoords: GameCoords;

  private score: number[] = [0, 0];

  private keyPress: number[] = [0, 0, 0, 0];

  private ballSpeedMultiplier: number;
  private ballSpeedMax:number;
  private ballSpeedLimit:number;
  
  constructor(
    private readonly gv: GameStartVar,
    private readonly databaseService: DatabaseService,
    private readonly games: Map<string, Game>,
    // Fixed param set
    private readonly canvasWidth = 1150,
    private readonly canvasHeight = 600,
    private readonly ballRadius = 15,
    private readonly paddleHeight = 150,
    private readonly paddleWidth = 30,
    private readonly maxScore = 5,
    ) {
    this.paddleSpeed = 0.8,
    this.round = 0;
    this.gameMode = GameMode.DEFAULT;
    this.ballSpeedMax = this.canvasWidth / 1000;
    this.paddleSpeedMax = 1.1;
  }

  private init() {
    switch (this.gameMode) {
      case GameMode.DEFAULT: {
        this.ballSpeedMultiplier = 1.2;
        break;
      }
      case GameMode.SPEED: {
        this.ballSpeedMultiplier = 1.4;
        break;
      }
    }
    this.ballSpeedLimit = this.canvasWidth / 2000 * this.ballSpeedMultiplier;
    this.ballX = this.canvasWidth / 2;
    this.ballY = this.canvasHeight / 2;
    this.ballSpeedX = this.ballSpeedLimit;
    if (Math.random() >= 0.5) {
      this.ballSpeedX = -this.ballSpeedX;
    }
    // +-22.7 degree range.
    this.ballSpeedY = this.ballSpeedX * 0.42 * (Math.random() * 2 - 1);
    for (let i = 0; i < 4; i++) {
      this.keyPress[i] = 0;
    }
    this.paddleSpeed = 0.8;
    this.paddle1Y = this.paddle2Y = (this.canvasHeight - this.paddleHeight) / 2;
    this.roundStartTime = Date.now();
    this.lastUpdateCoords = this.curState(this.roundStartTime);
  }

  gameStart() {
    this.gameStatus = GameStatus.MODESELECT;
    this.gv.server.to(this.gv.gameId).emit('matched', { p1: this.gv.p1.uid, p2: this.gv.p2.uid });
    this.roundStartTime = Date.now();
    this.gameLoop();
  }

  isPlayer(uid: number): boolean {
    return this.gv.p1.uid === uid || this.gv.p2.uid === uid;
  }

  isP1(uid: number): boolean {
    return this.gv.p1.uid === uid;
  }
  
  playerLeft(uid: number) {
    if (this.gameStatus <= GameStatus.RUNNING) {
      if (this.gv.p1.uid === uid) {
        this.score[0] = -1;
      } else {
        this.score[1] = -1;
      }
      this.gameStatus = GameStatus.FINISHED;
    }
  }
  
  upPress(uid: number) {
    if (this.gameStatus === GameStatus.RUNNING) {
      const curTime = Date.now();
      this.update(curTime);
      if (this.gv.p1.uid === uid) {
        this.keyPress[0] = Date.now();
      } else {
        this.keyPress[2] = Date.now();
      }
      this.lastUpdateCoords = this.curState(this.lastUpdateCoords.time);
      this.gv.server.to(this.gv.gameId).emit("syncData", this.lastUpdateCoords);
    }
  }
  
  upRelease(uid: number) {
    if (this.gameStatus === GameStatus.RUNNING) {
      const curTime = Date.now();
      this.update(curTime);
      if (this.gv.p1.uid === uid) {
        this.keyPress[0] = 0;
      } else {
        this.keyPress[2] = 0;
      }
      this.lastUpdateCoords = this.curState(this.lastUpdateCoords.time);
      this.gv.server.to(this.gv.gameId).emit("syncData", this.lastUpdateCoords);
    }
  }

  downPress(uid: number) {
    if (this.gameStatus === GameStatus.RUNNING) {
      const curTime = Date.now();
      this.update(curTime);
      if (this.gv.p1.uid === uid) {
        this.keyPress[1] = Date.now();
      } else {
        this.keyPress[3] = Date.now();
      }
      this.lastUpdateCoords = this.curState(this.lastUpdateCoords.time);
      this.gv.server.to(this.gv.gameId).emit("syncData", this.lastUpdateCoords);
    }
  }
  
  downRelease(uid: number) {
    if (this.gameStatus === GameStatus.RUNNING) {
      const curTime = Date.now();
      this.update(curTime);
      if (this.gv.p1.uid === uid) {
        this.keyPress[1] = 0;
      } else {
        this.keyPress[3] = 0;
      }
      this.lastUpdateCoords = this.curState(this.lastUpdateCoords.time);
      this.gv.server.to(this.gv.gameId).emit("syncData", this.lastUpdateCoords);
    }
  }

  setMode(mode: GameMode) {
    if (this.gameStatus === GameStatus.MODESELECT) {
      this.gameMode = mode;
      console.log(`${this.gv.gameId} mode: ${this.gameMode}`);
    }
  }

  getStatus(): GameStatus {
    return this.gameStatus;
  }

  gameInfo(): GameInfo {
    return {
      gameMode: this.gameMode,
      p1: this.gv.p1.uid,
      p2: this.gv.p2.uid,
    }
  }

  // Event driven update
  private async gameLoop() {
    const timeout = await this.update(Date.now());
    if (timeout !== -1) {
      setTimeout(this.gameLoop.bind(this), timeout);
      if (this.gameStatus === GameStatus.RUNNING) {
        this.gv.server.to(this.gv.gameId).emit("syncData", this.lastUpdateCoords);
      }
    } else {
      this.games.delete(this.gv.gameId);
    }
  }

  private isFinished(): boolean{
    return this.score[0] >= this.maxScore || this.score[1] >= this.maxScore;
  }
  
  private modeSelect(curTime: number) {
    console.log("mode select: ", curTime - this.roundStartTime);
    if (curTime - this.roundStartTime >= 5000) {
      this.gameStatus = GameStatus.COUNTDOWN;
      this.gv.server.to(this.gv.gameId).emit('gameStart', this.gameInfo());
      this.init();
      return 1;
    }
    return 5000 - (curTime - this.roundStartTime);
  }

  private countdown(curTime: number): number {
    if (this.isFinished() === true) {
      this.gameStatus = GameStatus.FINISHED;
      this.gv.server.to(this.gv.gameId).emit("finished", {p1Score: this.score[0], p2Score: this.score[1]});
      return 1;
    } else if (curTime - this.roundStartTime >= 3000) {
      this.gameStatus = GameStatus.RUNNING;
      this.init();
      return 1;
    }
    const objectInfo = {...this.lastUpdateCoords};
    objectInfo.ballSpeedX = 0;
    objectInfo.ballSpeedY = 0;
    this.gv.server.to(this.gv.gameId).emit('syncData', objectInfo);
    const timeout = 3000 - (curTime - this.roundStartTime);
    this.gv.server.to(this.gv.gameId).emit('countdown', {curTime: curTime, time: timeout});
    return timeout;
  }

  private getHitTime(): number {
    let hitPredictTimeX: number;
    let hitPredictTimeY: number;

    if (this.ballSpeedX > 0) {
      hitPredictTimeX = (this.canvasWidth - this.ballRadius - this.paddleWidth - this.ballX) / this.ballSpeedX;
    } else {
      hitPredictTimeX = (this.ballX - this.ballRadius - this.paddleWidth) / -this.ballSpeedX;
    }
    if (this.ballSpeedY > 0) {
      hitPredictTimeY = (this.canvasHeight - this.ballRadius - this.ballY) / this.ballSpeedY;
    } else if (this.ballSpeedY < 0) {
      hitPredictTimeY = (this.ballY - this.ballRadius) / -this.ballSpeedY;
    } else {
      hitPredictTimeY = Infinity;
    }
    if (hitPredictTimeX < hitPredictTimeY) {
      return hitPredictTimeX + 1;
    }
    return hitPredictTimeY + 1;
  }

  private hitP1Paddle() {
    this.ballX = 2 * (this.ballRadius + this.paddleWidth) - this.ballX;
    switch (this.gameMode) {
      case GameMode.DEFAULT: {
        this.ballSpeedX = -this.ballSpeedX;
        break;
      }
      case GameMode.SPEED: {
        // 8% faster
        if (this.ballSpeedLimit < this.canvasWidth / 800) {
          this.ballSpeedLimit *= 1.08;
        }
        if (this.paddleSpeed < this.paddleSpeedMax) {
          this.paddleSpeed *= 1.08;
        }
        this.ballSpeedX = this.ballSpeedLimit;
        break;
      }
    }
    if (this.keyPress[0] !== 0 && this.keyPress[1] === 0) {
      this.ballSpeedY -= this.ballSpeedLimit / 2;
      if (this.ballSpeedY < -this.ballSpeedLimit) {
        this.ballSpeedY = -this.ballSpeedLimit;
      }
    } else if (this.keyPress[0] === 0 && this.keyPress[1] !== 0) {
      this.ballSpeedY += this.ballSpeedLimit / 2;
      if (this.ballSpeedY > this.ballSpeedLimit) {
        this.ballSpeedY = this.ballSpeedLimit;
      }
    }
  }
  
  private hitP2Paddle() {
    this.ballX = 2 * (this.canvasWidth - this.ballRadius - this.paddleWidth) - this.ballX;
    switch (this.gameMode) {
      case GameMode.DEFAULT: {
        this.ballSpeedX = -this.ballSpeedX;
        break;
      }
      case GameMode.SPEED: {
        // 8% faster
        if (this.ballSpeedLimit < this.ballSpeedMax) {
          this.ballSpeedLimit *= 1.08;
        }
        if (this.paddleSpeed < this.paddleSpeedMax) {
          this.paddleSpeed *= 1.08;
        }
        this.ballSpeedX = -this.ballSpeedLimit;
        break;
      }
    }
    if (this.keyPress[2] !== 0 && this.keyPress[3] === 0) {
      this.ballSpeedY -= this.ballSpeedLimit / 2;
      if (this.ballSpeedY < -this.ballSpeedLimit) {
        this.ballSpeedY = -this.ballSpeedLimit;
      }
    } else if (this.keyPress[2] === 0 && this.keyPress[3] !== 0) {
      this.ballSpeedY += this.ballSpeedLimit / 2;
      if (this.ballSpeedY > this.ballSpeedLimit) {
        this.ballSpeedY = this.ballSpeedLimit;
      }
    }
  }
  
  private updateScore(i: number, time: number): number {
    this.gameStatus = GameStatus.COUNTDOWN;
    this.score[i]++;
    this.round++;
    this.lastUpdateCoords = this.curState(time);
    this.roundStartTime = Date.now();
    for(let i = 0; i < 4; i++) {
      this.lastUpdateCoords.keyPress[i] = 0;
    }
    this.gv.server.to(this.gv.gameId).emit("scoreInfo", {gameCoord: this.lastUpdateCoords, scoreInfo: {p1Score: this.score[0], p2Score: this.score[1]}});
    return 1;
  }
  
  private running(curTime: number): number {
    let timeout = 10;
    const dt = curTime - this.lastUpdate;
    if (dt > 0) {
      const keyPressTime = this.getKeyPressDt(curTime);
      this.paddleUpdate(keyPressTime);
      this.ballX += this.ballSpeedX * dt;
      this.ballY += this.ballSpeedY * dt;
      const isHitY = this.collisionCheckY();
      const isHitX = this.collisionCheckX();
      if (isHitY !== Direction.NONE) {
        if (isHitY === Direction.UP) {
          this.ballY = 2 * this.ballRadius - this.ballY;
        } else {
          this.ballY = 2 * (this.canvasHeight - this.ballRadius) - this.ballY;
        }
        this.ballSpeedY = -this.ballSpeedY;
      }
      if (isHitX !== Direction.NONE) {
        if (isHitX == Direction.LEFT) {
          if (this.collisionCheckP1Paddle() === Hit.PADDLE) {
            this.hitP1Paddle();
          } else {
            return this.updateScore(1, curTime);
          }
        } else {
          if (this.collisionCheckP2Paddle() === Hit.PADDLE) {
            this.hitP2Paddle();
          } else {
            return this.updateScore(0, curTime);
          }
        }
      }
      this.lastUpdateCoords = this.curState(curTime);
      timeout = this.getHitTime();
    }
    return timeout;
  }

  private async disconnect(): Promise<void> {
    const result = new GameEntity();
    result.gameType = this.gv.gameType;
    if (this.score[0] > this.score[1]){
      result.winner = this.gv.p1;
      result.loser = this.gv.p2;
      result.winnerScore = this.score[0];
      result.loserScore = this.score[1];
    } else {
      result.winner = this.gv.p2;
      result.loser = this.gv.p1;
      result.winnerScore = this.score[1];
      result.loserScore = this.score[0];
    }

    if (this.gv.gameType === GameType.PRIVATE) {
      await this.databaseService.saveGame(result, this.gv.gameType, 0, 0);
    } else {
      const newElo = this.eloLogic(result.winner.elo, result.loser.elo);
      await this.databaseService.saveGame(result, this.gv.gameType, newElo.winnerElo, newElo.loserElo);
    }

    this.gv.server.in(this.gv.gameId).disconnectSockets();
  }

  private async update(curTime: number): Promise<number> {
    let timeout:number
    switch(this.gameStatus) {
      case GameStatus.MODESELECT: {
        timeout = this.modeSelect(curTime);
        break;
      }
      case GameStatus.COUNTDOWN: {
        timeout = this.countdown(curTime);
        console.log(timeout);
        break;
      }
      case GameStatus.RUNNING: {
        timeout = this.running(curTime);
        break;
      }
      case GameStatus.FINISHED: {
        console.log("finished!!!!!");
        this.gv.server.to(this.gv.gameId).emit("finished", {p1Score: this.score[0], p2Score: this.score[1]});
        this.gameStatus = GameStatus.DISCONNECT;
        timeout = 1000;
        break;
      }
      case GameStatus.DISCONNECT: {
        await this.disconnect(); 
        timeout = -1;
        break;
      }

    }
    this.lastUpdate = curTime;
    // console.log(`[${Date.now()}] backend game login update`);
    return timeout;
  }
  
  private getKeyPressDt(curTime: number): number[] {
    const keyPressDt: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (this.keyPress[i] !== 0 && curTime > this.keyPress[i]) {
        keyPressDt.push(curTime - this.keyPress[i]);
        this.keyPress[i] = curTime;
      } else {
        keyPressDt.push(0);
      }
    }
    return keyPressDt;
  }

  private paddleUpdate(keyPressDt: number[]) {
    if (keyPressDt[0] !== 0) {
      if (this.paddle1Y > 0){
        this.paddle1Y -= this.paddleSpeed * keyPressDt[0];
      }
      if (this.paddle1Y < 0) {
        this.paddle1Y = 0;
      }
    }
    if (keyPressDt[1] !== 0) {
      if (this.paddle1Y < this.canvasHeight - this.paddleHeight){
        this.paddle1Y += this.paddleSpeed * keyPressDt[1];
      }
      if (this.paddle1Y > this.canvasHeight - this.paddleHeight) {
        this.paddle1Y = this.canvasHeight - this.paddleHeight;
      }
    }
    if (keyPressDt[2] !== 0) {
      if (this.paddle2Y > 0) {
        this.paddle2Y -= this.paddleSpeed * keyPressDt[2];
      }
      if (this.paddle2Y < 0) {
        this.paddle2Y = 0;
      }
    }
    if (keyPressDt[3] !== 0) {
      if (this.paddle2Y < this.canvasHeight - this.paddleHeight){
        this.paddle2Y += this.paddleSpeed * keyPressDt[3];
      }
      if (this.paddle2Y > this.canvasHeight - this.paddleHeight) {
        this.paddle2Y = this.canvasHeight - this.paddleHeight;
      }
    }
  }

  private collisionCheckX() {
    if (this.ballX <= this.ballRadius + this.paddleWidth) {
      return Direction.LEFT;
    } else if (this.ballX >= this.canvasWidth - this.ballRadius - this.paddleWidth) {
      return Direction.RIGHT;
    }
    return Direction.NONE;
  }

  private collisionCheckY() {
    if (this.ballY >= this.canvasHeight - this.ballRadius) {
      return Direction.DOWN;
    } else if (this.ballY <= this.ballRadius) {
      return Direction.UP;
    }
    return Direction.NONE;
  }

  private collisionCheckP1Paddle() {
    if (this.ballY >= this.paddle1Y && this.ballY <= this.paddle1Y + this.paddleHeight) {
      return Hit.PADDLE;
    }
    return Hit.WALL;
  }

  private collisionCheckP2Paddle() {
    if (this.ballY >= this.paddle2Y && this.ballY <= this.paddle2Y + this.paddleHeight) {
      return Hit.PADDLE;
    }
    return Hit.WALL;
  }

  private curState(time: number): GameCoords {
    return {
      paddle1Y: this.paddle1Y,
      ballX: this.ballX,
      ballY: this.ballY,
      paddle2Y: this.paddle2Y,
      ballSpeedX: this.ballSpeedX,
      ballSpeedY: this.ballSpeedY,
      paddleSpeed: this.paddleSpeed,
      keyPress: this.keyPress,
      time: time,
    };
  }

  private expectRating(myElo: number, opElo: number) {
    // 예상승률 =  1 /  ( 1 +  10 ^ ((상대레이팅점수 - 나의 현재 레이팅점수 ) / 400) )
    const rate = 400;
    const exponent = (opElo - myElo) / rate;
    const probability = 1 / (1 + Math.pow(10, exponent));
    return probability;
  }

  private newRating(myElo: number, opElo: number, isWin: boolean) {
    const K = 32;
    // rounded value
    if (isWin) {
      return Math.round(myElo + K  * (1 - this.expectRating(myElo, opElo)));
    } else {
      return Math.round(myElo + K  * (0 - this.expectRating(myElo, opElo)));
    }
  }

  private eloLogic(winnerElo: number, loserElo: number): { winnerElo: number, loserElo: number } {
    // Rn =  Ro +  K  (  W      -    We    )
    // 레이팅점수   =  현재레이팅점수  +   상수  ( 경기결과  -    예상승률 )
    // we =  1  / ( 1 +  10^  (( Rb - Ra  ) / 400) )    
    return { winnerElo: this.newRating(winnerElo, loserElo, true), loserElo: this.newRating(loserElo, winnerElo, false) };
  }

}
