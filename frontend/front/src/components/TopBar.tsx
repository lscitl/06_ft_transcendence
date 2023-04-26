import { Cookies } from "react-cookie";
import "../styles/TopBar.css";
import { Link, NavLink } from "react-router-dom";

export default function TopBar() {
  return (
    <div className="TopBarBG">
      <LogoBtn />
      <div className="TopBarBtnAlign">
        <ChatBtn />
        <QueueBtn />
        <ProfileBtn />
        <LogoutBtn />
      </div>
    </div>
  );
}

function getNavLinkStyle({ isActive }: { isActive: boolean }) {
  return {
    textDecoration: isActive ? "underline" : undefined,
  };
}

function LogoBtn() {
  return (
    <div className="TopBarBtn TopBarLogo">
      <a className="AStyle" href="https://github.com/42-MyMisters" target="_blank" rel="noreferrer">
        MyMisters
      </a>
    </div>
  );
}

function ChatBtn() {
  return (
    <div className="TopBarBtn">
      <NavLink to="/chat" className="AStyle" style={getNavLinkStyle}>
        Chat
      </NavLink>
    </div>
  );
}

function QueueBtn() {
  return (
    <div className="TopBarBtn">
      <NavLink to="/game" className="AStyle" style={getNavLinkStyle} >Queue</NavLink>
    </div>
  );
}

function ProfileBtn() {
  return (
    <div className="TopBarBtn">
      <NavLink to="/profile" className="AStyle" style={getNavLinkStyle}>
        Profile
      </NavLink>
    </div>
  );
}

function LogoutBtn() {
  function LogOut() {
    localStorage.clear();
  }
  return (
    <div className="TopBarBtn" onClick={LogOut}>
      Logout
    </div>
  );
}
