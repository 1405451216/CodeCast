import React from 'react';

interface TopBarProps {
  title: string;
}

const TopBar: React.FC<TopBarProps> = ({ title }) => {
  return (
    <div className="topbar">
      <div className="topbar-left">
      </div>
      <div className="topbar-right" />
    </div>
  );
};

export default TopBar;
