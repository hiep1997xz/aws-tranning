import { use, useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { useAuthStore } from '../store/auth-store';
import Password from 'antd/es/input/Password';

export default function LoginPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  useEffect(() => {
    form.setFieldsValue({ email:  "admin@example.com", password: "admin123456" });
  }, [form]);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', values);
      setUser(res.data.user);
      navigate('/');
    } catch {
      message.error('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-96">
        <Typography.Title level={3} className="text-center !mb-6">
          Sign In
        </Typography.Title>
        <Alert
          className="!mb-4"
          type="info"
          showIcon
          title={
            <span>
              Demo: <strong></strong> / <strong>admin123456</strong>
            </span>
          }
        />
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input size="large" placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password size="large" placeholder="••••••" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
