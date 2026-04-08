import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const items = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/users', icon: <UserOutlined />, label: 'Users' },
  { key: '/products', icon: <ShoppingOutlined />, label: 'Products' },
  { key: '/categories', icon: <AppstoreOutlined />, label: 'Categories' },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
      <div className="flex h-16 items-center justify-center font-bold text-white">
        {collapsed ? 'A' : 'Admin Panel'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}
