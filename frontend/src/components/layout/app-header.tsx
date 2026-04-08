import { Layout, Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';
import api from '../../lib/axios';

const { Header } = Layout;

export default function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.post('/api/auth/logout');
    clearUser();
    navigate('/login');
  };

  const menuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <Header className="flex items-center justify-between bg-white px-6 shadow-sm">
      <Typography.Title level={4} className="!mb-0">
        Admin Panel
      </Typography.Title>
      <Dropdown menu={{ items: menuItems }} placement="bottomRight">
        <Space className="cursor-pointer">
          <Avatar icon={<UserOutlined />} src={user?.avatarUrl} />
          <span>{user?.name}</span>
        </Space>
      </Dropdown>
    </Header>
  );
}
