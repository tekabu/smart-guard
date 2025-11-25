import { useNavigate } from "react-router-dom";

interface SidebarProps {
  activePage: string;
}

export default function Sidebar({ activePage }: SidebarProps) {
  const navigate = useNavigate();

  const menuItems = [
    { path: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
    { path: "/faculty", label: "Faculty", icon: "Users" },
    { path: "/students", label: "Students", icon: "GraduationCap" },
    { path: "/subjects", label: "Subjects", icon: "BookOpen" },
    { path: "/attendance", label: "Attendance", icon: "CheckSquare" },
    { path: "/sessions", label: "Sessions", icon: "Clock" },
    { path: "/door-control", label: "Door Control", icon: "DoorOpen" },
    { path: "/security", label: "Security", icon: "Shield" },
    { path: "/reports", label: "Reports", icon: "BarChart3" },
    { path: "/settings", label: "Settings", icon: "Settings" },
  ];

  const getIcon = (iconName: string) => {
    const iconClass = "w-5 h-5";
    switch (iconName) {
      case "LayoutDashboard":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
          </svg>
        );
      case "Users":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case "GraduationCap":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case "BookOpen":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case "CheckSquare":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "Clock":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx={12} cy={12} r={10} />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        );
      case "DoorOpen":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        );
      case "Shield":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case "BarChart3":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case "Settings":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx={12} cy={12} r={3} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a1.65 1.65 0 01-2.33 2.33l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a1.65 1.65 0 01-3.3 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a1.65 1.65 0 01-2.33-2.33l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a1.65 1.65 0 010-3.3h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a1.65 1.65 0 012.33-2.33l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a1.65 1.65 0 013.3 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a1.65 1.65 0 012.33 2.33l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a1.65 1.65 0 010 3.3h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        );
      default:
        return <span className="text-lg">📊</span>;
    }
  };

  return (
    <div className="w-72 bg-[#1a4b87] border-r border-gray-200/50 flex flex-col">
      {/* Logo/Brand Section */}
      <div className="p-6 border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-br from-[#1a4b87] to-[#A78BFA] rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">SG</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">SmartGuard</h2>
            <p className="text-xs text-gray-300">Security System</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-3 group ${
                activePage === item.path
                  ? "bg-white text-[#1a4b87] shadow-lg"
                  : "text-gray-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className={`${
                activePage === item.path ? "text-[#1a4b87]" : "text-gray-400 group-hover:text-white"
              }`}>
                {getIcon(item.icon)}
              </div>
              <span className="text-sm">{item.label}</span>
              {activePage === item.path && (
                <div className="ml-auto w-1.5 h-1.5 bg-[#1a4b87] rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-gray-200/50">
        <div className="bg-gradient-to-r from-[#3A57E8]/5 to-[#A78BFA]/5 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#10B981] to-[#34D399] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white">System Status</p>
              <p className="text-xs text-green-300">All Systems Operational</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
