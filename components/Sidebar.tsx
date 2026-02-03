import React from 'react';
import { LayoutDashboard, Settings, ShoppingBag, LogOut } from 'lucide-react';

interface SidebarProps {
  currentView: 'dashboard' | 'settings';
  onChangeView: (view: 'dashboard' | 'settings') => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: '数据概览', icon: LayoutDashboard },
    { id: 'settings', label: '系统设置', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 hidden md:flex flex-col z-20">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            O
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">Ozon助手</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as 'dashboard' | 'settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          退出登录
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
