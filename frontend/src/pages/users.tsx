import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  Typography,
  message,
  Avatar,
  Upload,
} from 'antd';
import { PlusOutlined, UserOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import api from '../lib/axios';
import type { User } from '../types/entities';

interface UserFormValues {
  name: string;
  email: string;
  password?: string;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm<UserFormValues>();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users').then((r) => r.data),
  });

  const buildFormData = (values: UserFormValues, file: File | null): FormData => {
    const fd = new FormData();
    fd.append('name', values.name);
    fd.append('email', values.email);
    if (values.password) fd.append('password', values.password);
    if (file) fd.append('avatar', file);
    return fd;
  };

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => api.post('/api/users', fd).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      closeModal();
      message.success('User created');
    },
    onError: () => message.error('Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: FormData }) =>
      api.put(`/api/users/${id}`, fd).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      closeModal();
      message.success('User updated');
    },
    onError: () => message.error('Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      message.success('User deleted');
    },
    onError: () => message.error('Failed to delete user'),
  });

  const openCreate = () => {
    setEditing(null);
    setAvatarFile(null);
    setFileList([]);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setAvatarFile(null);
    setFileList(
      user.avatarUrl
        ? [{ uid: '-1', name: 'avatar', status: 'done', url: user.avatarUrl }]
        : [],
    );
    form.setFieldsValue({ name: user.name, email: user.email });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setAvatarFile(null);
    setFileList([]);
    form.resetFields();
  };

  const onFinish = (values: UserFormValues) => {
    const fd = buildFormData(values, avatarFile);
    if (editing) {
      updateMutation.mutate({ id: editing.id, fd });
    } else {
      createMutation.mutate(fd);
    }
  };

  const columns: ColumnsType<User> = [
    {
      title: 'Avatar',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      width: 72,
      render: (url: string | null, record: User) => (
        <Avatar src={url ?? undefined} icon={<UserOutlined />}>
          {!url ? record.name[0]?.toUpperCase() : undefined}
        </Avatar>
      ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: User) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this user?"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Typography.Title level={3} className="!mb-0">
          Users
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add User
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={isLoading}
      />
      <Modal
        title={editing ? 'Edit User' : 'Add User'}
        open={open}
        onCancel={closeModal}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={editing ? [] : [{ required: true, min: 6 }]}
          >
            <Input.Password placeholder={editing ? 'Leave blank to keep current' : ''} />
          </Form.Item>
          <Form.Item label="Avatar">
            <Upload
              listType="picture"
              fileList={fileList}
              maxCount={1}
              beforeUpload={(file) => {
                setAvatarFile(file);
                setFileList([{ uid: file.uid, name: file.name, status: 'done' }]);
                return false;
              }}
              onRemove={() => {
                setAvatarFile(null);
                setFileList([]);
              }}
            >
              <Button icon={<UploadOutlined />}>Select Avatar</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Space className="w-full justify-end">
              <Button onClick={closeModal}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
