import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { UserOutlined, ShoppingOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '../lib/axios';
import type { User, Category, Product } from '../types/entities';

export default function DashboardPage() {
  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users').then((r) => r.data.users ?? []),
  });
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data.products ?? []),
  });
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data.categories ?? []),
  });

  return (
    <>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Users"
              value={users?.length ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Products"
              value={products?.length ?? 0}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Categories"
              value={categories?.length ?? 0}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
