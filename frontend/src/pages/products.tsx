import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  Typography,
  message,
  Upload,
} from 'antd';
import { PlusOutlined, ShoppingOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import api from '../lib/axios';
import type { Product, Category } from '../types/entities';

interface ProductFormValues {
  name: string;
  description?: string;
  price: number;
  stock: number;
  categoryId?: string;
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm<ProductFormValues>();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/api/products').then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data),
  });

  const buildFormData = (values: ProductFormValues, file: File | null): FormData => {
    const fd = new FormData();
    fd.append('name', values.name);
    if (values.description) fd.append('description', values.description);
    fd.append('price', String(values.price));
    fd.append('stock', String(values.stock));
    if (values.categoryId) fd.append('categoryId', values.categoryId);
    if (file) fd.append('image', file);
    return fd;
  };

  const createMutation = useMutation({
    mutationFn: (fd: FormData) => api.post('/api/products', fd).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      closeModal();
      message.success('Product created');
    },
    onError: () => message.error('Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: FormData }) =>
      api.put(`/api/products/${id}`, fd).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      closeModal();
      message.success('Product updated');
    },
    onError: () => message.error('Failed to update product'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      message.success('Product deleted');
    },
    onError: () => message.error('Failed to delete product'),
  });

  const openCreate = () => {
    setEditing(null);
    setImageFile(null);
    setFileList([]);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setImageFile(null);
    setFileList(
      product.imageUrl
        ? [{ uid: '-1', name: 'image', status: 'done', url: product.imageUrl }]
        : [],
    );
    form.setFieldsValue({
      name: product.name,
      description: product.description ?? undefined,
      price: parseFloat(product.price),
      stock: product.stock,
      categoryId: product.categoryId ?? undefined,
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setImageFile(null);
    setFileList([]);
    form.resetFields();
  };

  const onFinish = (values: ProductFormValues) => {
    const fd = buildFormData(values, imageFile);
    if (editing) {
      updateMutation.mutate({ id: editing.id, fd });
    } else {
      createMutation.mutate(fd);
    }
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url: string | null) =>
        url ? (
          <img
            src={url}
            alt="product"
            className="h-12 w-12 rounded object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center">
            <ShoppingOutlined />
          </div>
        ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (v: string) => `$${parseFloat(v).toFixed(2)}`,
    },
    { title: 'Stock', dataIndex: 'stock', key: 'stock' },
    {
      title: 'Category',
      key: 'category',
      render: (_: unknown, record: Product) => record.category?.name ?? '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Product) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this product?"
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
          Products
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Product
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={products}
        loading={isLoading}
      />
      <Modal
        title={editing ? 'Edit Product' : 'Add Product'}
        open={open}
        onCancel={closeModal}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, type: 'number', min: 0 }]}
          >
            <InputNumber className="w-full" min={0} step={0.01} precision={2} prefix="$" />
          </Form.Item>
          <Form.Item
            name="stock"
            label="Stock"
            rules={[{ required: true, type: 'number', min: 0 }]}
          >
            <InputNumber className="w-full" min={0} precision={0} />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <Select allowClear placeholder="Select a category">
              {categories.map((cat) => (
                <Select.Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Image">
            <Upload
              listType="picture"
              fileList={fileList}
              maxCount={1}
              beforeUpload={(file) => {
                setImageFile(file);
                setFileList([{ uid: file.uid, name: file.name, status: 'done' }]);
                return false;
              }}
              onRemove={() => {
                setImageFile(null);
                setFileList([]);
              }}
            >
              <Button icon={<UploadOutlined />}>Select Image</Button>
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
