-- اسکریپت ایجاد دیتابیس (همان اسکریپت قبلی)
-- ایجاد جداول اصلی برای سیستم مدیریت فروشگاه

-- جدول فروشگاهها
CREATE TABLE stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    google_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول دستهبندیها
CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent UUID REFERENCES categories(id),
    product_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول محصولات
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id),
    price DECIMAL(10,2) NOT NULL,
    parent UUID REFERENCES products(id),
    description TEXT,
    is_sold BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول فروشها
CREATE TABLE sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id),
    price DECIMAL(10,2) NOT NULL,
    sold_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ایجاد ایندکسها برای عملکرد بهتر
CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_email ON stores(email);
CREATE INDEX idx_stores_approved ON stores(approved);
CREATE INDEX idx_categories_store_id ON categories(store_id);
CREATE INDEX idx_categories_parent ON categories(parent);
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_parent ON products(parent);
CREATE INDEX idx_products_is_sold ON products(is_sold);
CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_sold_at ON sales(sold_at);
CREATE INDEX idx_sales_product_id ON sales(product_id);

-- ایجاد تریگر برای بهروزرسانی updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ایجاد پالیسیهای امنیتی (Row Level Security)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- پالیسی برای فروشگاهها
CREATE POLICY "Users can view own store" ON stores
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all stores" ON stores
    FOR SELECT USING (auth.jwt() ->> 'email' = 'admin@example.com');

CREATE POLICY "Users can update own store" ON stores
    FOR UPDATE USING (auth.uid() = user_id);

-- پالیسی برای دستهبندیها
CREATE POLICY "Users can manage own categories" ON categories
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all categories" ON categories
    FOR ALL USING (auth.jwt() ->> 'email' = 'admin@example.com');

-- پالیسی برای محصولات
CREATE POLICY "Users can manage own products" ON products
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all products" ON products
    FOR ALL USING (auth.jwt() ->> 'email' = 'admin@example.com');

-- پالیسی برای فروشها
CREATE POLICY "Users can manage own sales" ON sales
    FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all sales" ON sales
    FOR ALL USING (auth.jwt() ->> 'email' = 'admin@example.com');

-- ایجاد دادههای نمونه
INSERT INTO stores (user_id, store_name, owner_name, email, approved, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'فروشگاه نمونه', 'مدیر نمونه', 'store@example.com', true, NOW());

-- درج دستهبندیهای نمونه
INSERT INTO categories (store_id, name, parent, product_count) VALUES
((SELECT id FROM stores WHERE email = 'store@example.com'), 'الکترونیک', NULL, 0),
((SELECT id FROM stores WHERE email = 'store@example.com'), 'مواد غذایی', NULL, 0),
((SELECT id FROM stores WHERE email = 'store@example.com'), 'ادویه جات', NULL, 0),
((SELECT id FROM stores WHERE email = 'store@example.com'), 'لوازم خانگی', NULL, 0),
((SELECT id FROM stores WHERE email = 'store@example.com'), 'پوشاک', NULL, 0);

-- درج محصولات نمونه
INSERT INTO products (store_id, name, category_id, price, parent, description, is_sold) VALUES
((SELECT id FROM stores WHERE email = 'store@example.com'), 'گوشی موبایل سامسونگ', 
 (SELECT id FROM categories WHERE name = 'الکترونیک' AND store_id = (SELECT id FROM stores WHERE email = 'store@example.com')), 
 8500000, NULL, 'گوشی موبایل سری سامسونگ', false),
 
((SELECT id FROM stores WHERE email = 'store@example.com'), 'مدل Galaxy S21', 
 (SELECT id FROM categories WHERE name = 'الکترونیک' AND store_id = (SELECT id FROM stores WHERE email = 'store@example.com')), 
 10200000, (SELECT id FROM products WHERE name = 'گوشی موبایل سامسونگ'), 'گوشی پرچمدار سری گلکسی', false),
 
((SELECT id FROM stores WHERE email = 'store@example.com'), 'برنج ایرانی', 
 (SELECT id FROM categories WHERE name = 'مواد غذایی' AND store_id = (SELECT id FROM stores WHERE email = 'store@example.com')), 
 150000, NULL, 'برنج مرغوب ایرانی', false);