import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import AppSidebar from './sidebar';
import AppHeader from './app-header';

const { Content } = Layout;

export default function AppLayout() {
  return (
    <Layout className="min-h-screen">
      <AppSidebar />
      <Layout>
        <AppHeader />
        <Content className="m-6 rounded-lg bg-white p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
