# IT Asset Management System
## سامانه جامع مدیریت دارایی‌های فناوری اطلاعات

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

---

### [English Description](#english) | [توضیحات و راهنمای فارسی](#فارسی)

---

<a name="english"></a>
## English Overview

**IT Asset Management** is a modern, enterprise-grade web application designed for corporate IT departments to oversee hardware lifecycles, monitor employee equipment assignments, manage IT stock availability, track temporary/permanent handovers, and execute audit-compliant returns.

Built with a **Modern Minimalist SaaS Dashboard** design, it features light/dark themes, responsive layouts for desktop and mobile, strict schema validations, and an asynchronous typed mock service layer prepared for seamless future integration with a **Python FastAPI** REST backend and **PostgreSQL** database.

### Key Capabilities

1. **Executive Dashboard**:
   - **7 Standardized Summary KPI Cards**:
     - `All Devices`: Total fleet count.
     - `In Use`: Actively deployed assets.
     - `Spare / IT Stock`: Available inventory ready in the IT stockroom.
     - `TEMP Active Handovers`: Active temporary loaner devices.
     - `Needs Review`: Operational indicator calculated solely from `Revision Date` older than the compliance threshold (default: 6 months).
     - `Disposed`: Decommissioned or recycled assets.
     - `Pending Confirmations`: Handovers awaiting employee receipt confirmation.
   - **Attention Queues**: Quick access to overdue revision checks and pending handover sign-offs.
   - **Chronological Transaction Log**: Real-time stream of all handover and return events with responsible IT staff attribution.

2. **Hardware Assets Workspace (15 Approved Fields)**:
   - Full data table displaying: *Asset Number, Revision, Type, AC Owner (official accounting/audit owner), Personal Code, Current User Name, Department, CC (Cost Center), eForm Number, Model, Label (`Yes`/`No`), Serial Number, Status (`In Use`/`Spare`/`Disposed`), Location, Comment*.
   - Live search across asset numbers, serials, models, assignees, and locations.
   - Segmented filter controls by status, operational flags, hardware types, and label attachments.
   - Subordinate-scoped view when logged in as a Manager / Supervisor.
   - Detail drawer with complete asset history and interactive return / handover actions.

3. **Employee Directory (9 Approved Fields)**:
   - Table covering: *First Name, Last Name, Personal Code, Department, Work Group, Site, Job Title, Direct Manager, Mobile Number*.
   - Assigned hardware drawer with guaranteed exclusion of returned devices.

4. **Excel Import Engine (.xlsx / .xls)**:
   - Native client-side binary parsing of Microsoft Excel files.
   - Schema validation against all 15 approved Asset fields.
   - **Unconditional Duplicate Rejection**: Rejects any duplicate Asset Numbers or Serial Numbers in inventory or within the file.
   - Preview grid with row-level error reasons and safe batch import.
   - Includes downloadable `.xlsx` template and a 1-click sample demo batch.

5. **Event-Sourced Handover & Return Models**:
   - `HandoverRecord`: Supports `Temporary` and `Permanent` agreements, condition tracking (`Good`, `Minor Damage`, `Damaged`, `Not Working`), and IT user attribution.
   - `ReturnRecord`: Dedicated return event model capturing return condition, notes, and IT technician info.
   - **Deterministic Post-Return State Transition**:
     1. Clears employee assignment (`personalCode` and `currentUserName`).
     2. Sets status to `Spare`.
     3. Updates location to configured IT Stockroom.
     4. **Preserves general asset comment unmodified** (return notes are recorded exclusively in `ReturnRecord`).

6. **Role-Based Access Control (RBAC)**:
   - `IT Admin`: Full system privileges, configuration, Excel onboarding, handover/return processing.
   - `Manager / Supervisor`: Subordinate-scoped visibility (based on `directManager` relationships).
   - `Employee`: Self-service view of assigned devices and handover receipt confirmation.

---

## Linux Installation & Setup

### Method 1: Automated Script with Custom Port (Recommended)

The repository provides an automated installation script (`install.sh`) that checks prerequisites, prompts for a custom port, installs dependencies, builds the production bundle, and generates quick-start scripts.

```bash
# 1. Clone repository
git clone https://github.com/mohammadaminkhoshnasab-alt/asset-managment.git
cd asset-managment

# 2. Make installer executable and run
chmod +x install.sh
./install.sh
```

During execution, the script will ask for your desired port:
```text
Enter port number to run application [Default: 3000]: 8080
```

Once installed, start the application at any time:
```bash
# Run Production Server (using chosen port)
./start.sh

# Run Development Server (with hot reloading)
./start-dev.sh
```

---

### Method 2: Manual Installation on Linux

#### Prerequisites
- Node.js 18.x or higher (`node -v`)
- npm 9.x or higher (`npm -v`)

To install Node.js on Ubuntu/Debian:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
```

#### Steps:
```bash
# 1. Clone repo
git clone https://github.com/mohammadaminkhoshnasab-alt/asset-managment.git
cd asset-managment

# 2. Install dependencies
npm install

# 3. Choose your port (e.g. 8080) and run in Development mode:
npm run dev -- --port 8080 --host 0.0.0.0

# 4. OR build and serve for Production:
npm run build
npx vite preview --port 8080 --host 0.0.0.0
```

---

### Running as a Linux Background Service (Systemd)

To keep the application running continuously in the background on your Linux server:

1. Create a systemd service file:
```bash
sudo nano /etc/systemd/system/itam.service
```

2. Paste the following configuration (replace `/path/to/asset-managment` and `3000` with your actual path and port):
```ini
[Unit]
Description=IT Asset Management Frontend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/asset-managment
ExecStart=/usr/bin/npx vite preview --port 3000 --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable itam
sudo systemctl start itam
sudo systemctl status itam
```

Access the dashboard at `http://<YOUR_SERVER_IP>:3000`.

---

<a name="فارسی"></a>
## توضیحات و راهنمای فارسی

**سامانه مدیریت دارایی‌های فناوری اطلاعات (IT Asset Management)** یک وب‌اپلیکیشن جامع و پیشرفته سازمانی است که برای ردیابی چرخه عمر تجهیزات سخت‌افزاری، تخصیص دستگاه‌ها به کارمندان، مدیریت موجودی انبار انفورماتیک، ثبت تحویل‌های موقت و دائم و ثبت استرداد استاندارد دستگاه‌ها طراحی شده است.

این سامانه با رابط کاربری مدرن SaaS، پشتیبانی کامل از حالت‌های **تاریک (Dark)** و **روشن (Light)**، ساختار کاملاً واکنش‌گرا (موبایل، تبلت و دسکتاپ)، اعتبارسنجی دقیق داده‌ها و لایه سرویس تایپ‌شده آماده اتصال به بک‌اند آینده (**Python FastAPI** و پایگاه‌داده **PostgreSQL**) پیاده‌سازی شده است.

### امکانات کلیدی سامانه

1. **داشبورد مدیریتی (Dashboard)**:
   - **۷ کارت خلاصه شاخص‌های کلیدی (KPI)**:
     - **All Devices (کل دستگاه‌ها)**: مجموع دارایی‌های ثبت‌شده.
     - **In Use (در حال استفاده)**: وضعیت دارایی در دست کارمندان.
     - **Spare / IT Stock (موجودی انبار)**: تجهیزات آماده تحویل در انبار IT.
     - **TEMP Active Handovers (تحویل موقت فعال)**: شاخص عملیاتی دستگاه‌های امانی.
     - **Needs Review (نیازمند بازبینی)**: محاسبه‌شده صرفاً بر اساس تاریخ بازبینی (`Revision`) که از آستانه مجاز (پیش‌فرض ۶ ماه) فراتر رفته باشد.
     - **Disposed (اسقاط / بازیافت)**: وضعیت دارایی‌های از رده خارج شده.
     - **Pending Confirmations (در انتظار تأیید)**: تحویل‌های در انتظار تایید دریافت کارمند.
   - **صف‌های هشدار فوری**: مشاهده دارایی‌های نیازمند بازبینی دوره‌ای و تأییدیه‌های معوق.
   - **گزارش لحظه‌ای تراکنش‌ها**: نمایش وقایع تحویل و استرداد همراه با نام کارشناس IT مسئول.

2. **مدیریت دارایی‌های سخت‌افزاری (۱۵ فیلد استاندارد)**:
   - جدول جامع شامل: *شماره دارایی (Asset Number)، تاریخ بازبینی (Revision)، نوع دستگاه (Type)، مالک حسابداری/حسابرسی (AC Owner)، کد پرسنلی (Personal Code)، نام کاربر جاری، دپارتمان، مرکز هزینه (CC)، شماره فرم الکترونیکی (eForm)، مدل، برچسب (`Yes`/`No`)، شماره سریال، وضعیت (`In Use`/`Spare`/`Disposed`)، موقعیت مکانی، توضیحات*.
   - جستجوی پیشرفته بر اساس شماره دارایی، سریال، مدل، کاربر و مکان.
   - فیلترهای تفکیک‌شده بر اساس وضعیت، پرچم‌های عملیاتی، برچسب فیزیکی و دسته‌بندی دستگاه.
   - محدودسازی خودکار دید مدیر/سرپرست به تجهیزات زیرمجموعه مستقیم خود.
   - پنل کشویی جزئیات دارایی با تاریخچه کامل و دکمه‌های اقدام به تحویل یا استرداد.

3. **فهرست کارمندان (۹ فیلد مصوب)**:
   - نمایش: *نام، نام خانوادگی، کد پرسنلی، دپارتمان، گروه کاری، سایت/شعبه، عنوان شغلی، مدیر مستقیم، شماره موبایل*.
   - پنل بازرسی دستگاه‌های تخصیص‌یافته به کارمند با تضمین حذف خودکار دستگاه‌های مسترد شده.

4. **سیستم ورود اطلاعات از اکسل (Excel Import Wizard)**:
   - پردازش مستقیم فایل‌های اکسل (`.xlsx` و `.xls`) در مرورگر با کتابخانه SheetJS.
   - اعتبارسنجی خودکار هر سطر بر اساس ۱۵ فیلد استاندارد دارایی.
   - **رد قطعی و غیرقابل غیرفعال‌سازی مقادیر تکراری**: شماره دارایی و شماره سریال تکراری بلافاصله شناسایی و رد می‌شوند.
   - جدول پیش‌نمایش سطرهای معتبر و نامعتبر با ذکر دقیق علت خطا قبل از تأیید نهایی.
   - امکان دانلود فایل قالب نمونه اکسل و بارگذاری داده‌های تستی با ۱ کلیک.

5. **مدل‌های تفکیک‌شده رویداد تحویل و استرداد**:
   - `HandoverRecord`: ثبت تحویل موقت (Temporary) یا دائم (Permanent)، شرایط دستگاه (`Good`, `Minor Damage`, `Damaged`, `Not Working`) و کارشناس IT ثبت‌کننده.
   - `ReturnRecord`: مدل مستقل ثبت استرداد تجهیزات به انبار همراه با وضعیت فیزیکی و توضیحات استرداد.
   - **تغییر وضعیت قطعی دارایی پس از استرداد**:
     ۱. حذف تخصیص کارمند (`personalCode` و `currentUserName` خالی می‌شوند).
     ۲. تغییر وضعیت به `Spare`.
     ۳. به‌روزرسانی مکان به انبار مرکزی IT.
     ۴. **عدم بازنویسی و حفظ کامل توضیحات عمومی دارایی** (نکات مربوط به بازگشت صرفاً در `ReturnRecord` نگهداری می‌شوند).

6. **کنترل دسترسی نقش‌محور (RBAC)**:
   - `IT Admin`: دسترسی کامل مدیریتی، پیکربندی آستانه بازبینی، بارگذاری اکسل، ثبت تحویل و بازگشت.
   - `Manager / Supervisor`: مشاهده دارایی‌های زیردستان مستقیم بر اساس رابطه سازمانی (`directManager`).
   - `Employee`: مشاهده دستگاه‌های شخصی و امکان ثبت تأیید دریافت تجهیزات.

---

## راهنمای نصب و راه‌اندازی در لینوکس

### روش اول: نصب خودکار با اسکریپت و امکان انتخاب پورت (پیشنهادی)

پروژه دارای یک اسکریپت نصب خودکار به نام `install.sh` است که پیش‌نیازها را بررسی کرده، پورت دلخواه شما را دریافت می‌کند، وابستگی‌ها را نصب کرده و نسخه نهایی را بیلد می‌کند:

```bash
# ۱. کلون کردن مخزن
git clone https://github.com/mohammadaminkhoshnasab-alt/asset-managment.git
cd asset-managment

# ۲. ایجاد دسترسی اجرایی و اجرای اسکریپت
chmod +x install.sh
./install.sh
```

در حین نصب، از شما خواسته می‌شود پورت دلخواه خود را وارد کنید (پیش‌فرض: ۳۰۰۰):
```text
Enter port number to run application [Default: 3000]: 8080
```

پس از پایان نصب، با یکی از فایل‌های ایجادشده می‌توانید سامانه را اجرا کنید:
```bash
# اجرای نسخه نهایی (Production):
./start.sh

# اجرای محیط توسعه (Development):
./start-dev.sh
```

---

### روش دوم: نصب دستی در لینوکس

#### پیش‌نیازها:
- نودجی‌اس نسخه ۱۸ به بالا (`node -v`)
- ابزار npm نسخه ۹ به بالا (`npm -v`)

نصب نودجی‌اس روی اوبونتو یا دبیان:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
```

#### مراحل اجرا:
```bash
# ۱. کلون مخزن
git clone https://github.com/mohammadaminkhoshnasab-alt/asset-managment.git
cd asset-managment

# ۲. نصب پکیج‌ها
npm install

# ۳. اجرای محیط توسعه روی پورت دلخواه (مثلاً ۸۰۸۰):
npm run dev -- --port 8080 --host 0.0.0.0

# ۴. یا کامپایل نسخه پروداکشن و اجرا روی پورت دلخواه:
npm run build
npx vite preview --port 8080 --host 0.0.0.0
```

---

### تنظیم اجرای دائم در پس‌زمینه لینوکس (سرویس Systemd)

برای فعال نگه‌داشتن سامانه به عنوان یک سرویس پس‌زمینه همیشگی:

۱. ایجاد فایل سرویس:
```bash
sudo nano /etc/systemd/system/itam.service
```

۲. درج پیکربندی زیر (مسیر و پورت را متناسب با سرور خود تغییر دهید):
```ini
[Unit]
Description=IT Asset Management Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/asset-managment
ExecStart=/usr/bin/npx vite preview --port 3000 --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

۳. فعال‌سازی و راه‌اندازی سرویس:
```bash
sudo systemctl daemon-reload
sudo systemctl enable itam
sudo systemctl start itam
sudo systemctl status itam
```

سپس در مرورگر به آدرس `http://<IP_سرور>:3000` مراجعه نمایید.

---

## ساختار پوشه‌ها و معماری نرم‌افزار

```text
├── install.sh                  # اسکریپت نصب و راه‌اندازی خودکار لینوکس با قابلیت انتخاب پورت
├── start.sh                    # اسکریپت اجرای سریع نسخه نهایی روی پورت تعیین‌شده
├── index.html                  # نقطه ورودی HTML و بارگذاری فونت Plus Jakarta Sans
├── src/
│   ├── App.tsx                 # کامپوننت اصلی و روتینگ ۷ نمای اصلی
│   ├── main.tsx                # نقطه اتصال React 19 به DOM
│   ├── index.css               # استایل‌های Tailwind CSS v4 و تعریف واریانت دارک
│   ├── context/
│   │   └── AppContext.tsx      # مدیریت حالت تم، نمای فعال و کاربر جاری (RBAC)
│   ├── types/
│   │   └── asset.ts            # مدل‌های ۱۵ فیلد دارایی، ۹ فیلد کارمند، نقش‌ها و رویدادها
│   ├── services/
│   │   ├── assetService.ts     # کلاینت تایپ‌شده آماده اتصال به FastAPI
│   │   ├── excelParser.ts      # موتور پردازش و اعتبارسنجی اکسل و تولید قالب
│   │   └── mockData.ts         # مجموعه داده‌های شبیه‌سازی‌شده مشخص
│   └── components/
│       ├── layout/
│       │   ├── SidebarNav.tsx  # نوار ناوبری عمودی رسیپانسیو
│       │   └── TopHeader.tsx   # هدر بالا همراه با تغییر نقش و سوییچ دارک/لایت
│       ├── modals/
│       │   ├── ReturnModal.tsx # پنجره استرداد دارایی به انبار
│       │   └── HandoverModal.tsx# پنجره ثبت تحویل موقت/دائم
│       └── views/
│           ├── DashboardView.tsx # داشبورد ۷ کارته و گزارش وقایع
│           ├── AssetsView.tsx    # جدول ۱۵ فیلدی و فیلترهای عملیاتی
│           ├── EmployeesView.tsx # فهرست ۹ فیلدی پرسنل و بازرسی تجهیزات
│           ├── ReportsView.tsx   # نمودارها و گزارش‌های انطباق بازبینی
│           ├── ImportView.tsx    # سیستم ورود اکسل و بررسی مغایرت و تکرار
│           ├── SettingsView.tsx  # تنظیمات آستانه بازبینی و مکان انبار
│           └── UserManagementView.tsx # مدیریت کاربران و تغییر نقش (RBAC)
└── package.json
```