import jwt_decode from "jwt-decode";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useCookies } from "react-cookie";

import BackGround from "../components/BackGround";
import SignInModal from "../components/LoginPage/SignIn";
import TFAModal from "../components/LoginPage/TwoFactorAuth";

import { useNavigate } from "react-router-dom";
import { TFAEnabledAtom, cookieAtom, isFirstLoginAtom, refreshTokenAtom, loginModalJudgeAtom } from "../components/atom/LoginAtom";

import InitialSettingModal from "../components/LoginPage/InitialSetting";
import * as chatAtom from "../components/atom/ChatAtom";
import { hasLoginAtom } from "../components/atom/ChatAtom";

import { UserAtom } from "../components/atom/UserAtom";
import * as api from "../event/api.request";

export default function LoginPage() {
  /* localstorage에 없는데 cookie에 있으면 로그인이 된거다 */
  /* localstorage에 있으면 로그인 된거다 */
  const [refreshToken, setRefreshToken] = useAtom(refreshTokenAtom);
  const setCookie = useSetAtom(cookieAtom);
  const [TFAEnabled, setTFAEnabled] = useAtom(TFAEnabledAtom);
  const [hasLogin, setHasLogin] = useAtom(hasLoginAtom);
  const [isFirstLogin, setIsFirstLogin] = useAtom(isFirstLoginAtom);
  const setUserInfo = useSetAtom(UserAtom);
  const [loginModalJudge, setLoginModalJudge] = useAtom(loginModalJudgeAtom);
  const adminConsole = useAtomValue(chatAtom.adminConsoleAtom);
  const refreshTokenKey = "refreshToken";
  const [cookies, , removeCookie] = useCookies([refreshTokenKey]);
  const navigate = useNavigate();

  const logOutHandler = () => {
    api.LogOut(adminConsole, setRefreshToken, navigate, "/");
  };

  const initialSettingHandler = async () => {
    const getMeResponse = await api.FirstTimeGetMyInfo(adminConsole, hasLogin, setUserInfo, navigate, setHasLogin, setIsFirstLogin);
    if (getMeResponse === 401) {
      const refreshResponse = await api.RefreshToken(adminConsole);
      if (refreshResponse !== 201) {
        logOutHandler();
      } else {
        const getMeResponse = await api.FirstTimeGetMyInfo(adminConsole, hasLogin, setUserInfo, navigate, setHasLogin, setIsFirstLogin);
        if (getMeResponse === 401) {
          logOutHandler();
        }
      }
    }
  };

  useEffect(() => {
    if (cookies[refreshTokenKey] !== undefined) {
      setCookie(true);
      localStorage.setItem("refreshToken", cookies[refreshTokenKey]);
      removeCookie(refreshTokenKey);
      setCookie(false);
    }

    const storedRefreshToken = localStorage.getItem("refreshToken");
    if (storedRefreshToken !== null) {
      setRefreshToken(true);

      const decoded: any = jwt_decode(JSON.stringify(storedRefreshToken));
      if (decoded.twoFactorEnabled) {
        if (!decoded.twoFactorAuthenticated) {
          setTFAEnabled(true);
        } else {
          setHasLogin(true);
          navigate("/chat");
        }
      } else {
        initialSettingHandler();
      }
    } else {
      setRefreshToken(false);
      setLoginModalJudge(true);
    }
  }, [cookies]);

  return (
    <BackGround>
      {
        refreshToken
          ? isFirstLogin
            ? <InitialSettingModal />
            : TFAEnabled
              ? < TFAModal />
              : ''
          : loginModalJudge
            ? <SignInModal />
            : ''
      }
    </BackGround>
  );
}
