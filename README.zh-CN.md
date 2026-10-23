<div align="center">

<picture>
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.png">
  <img alt="NOIR UI — Monochrome. Minimal. Fluid. Motion-blur." src=".github/assets/banner-dark.png" width="100%">
</picture>

<br/>

**一个每次交互都以动态模糊回应的 React 组件库。**<br/>
两种墨色、发丝级描边，运动沿自身速度拖出模糊，然后清晰落定。

<br/>

![React](https://img.shields.io/badge/React-18%20%7C%2019-000?style=flat-square&labelColor=fff&color=000)
![Dependencies](https://img.shields.io/badge/runtime%20deps-0-000?style=flat-square&labelColor=fff&color=000)
![Size](https://img.shields.io/badge/gzip-30%20kB%20js%20%2B%2010%20kB%20css-000?style=flat-square&labelColor=fff&color=000)
![Components](https://img.shields.io/badge/components-40%2B-000?style=flat-square&labelColor=fff&color=000)

[English](README.md) · [简体中文](README.zh-CN.md)

</div>

<br/>

<p align="center">
  <img src=".github/assets/tour.gif" alt="NOIR UI 文档站演示：页面切换、导航高亮滑动、分段控件、主题圆形揭示与命令面板" width="100%">
</p>

<br/>

## 为什么是 NOIR

<table>
<tr>
<td width="33%" valign="top">

**单色**

只有 `#000`、`#fff` 和一组透明度阶梯。层级来自字重、留白与运动，从不依赖色相。

</td>
<td width="33%" valign="top">

**由速度驱动，而非关键帧**

模糊与拉伸由元素的**瞬时速度**实时计算：最快时拖影最重，落定时恰好消失。

</td>
<td width="33%" valign="top">

**连续性**

没有任何突变。文字逐字形变，数字像里程表一样滚动，浮层从模糊中朝锚点显现；运动被打断时，从当前帧继续。

</td>
</tr>
</table>

<br/>

## 动效

### 选中态是一个会移动的物体，从不瞬移

<img src=".github/assets/smear.gif" alt="分段控件、标签页、单选组、开关与滑块，指示块沿路径拖出模糊" width="100%">

Segmented、Tabs、NavList、ListBox、RadioGroup 共用同一个移动指示块：它沿同一条曲线移动，朝运动的尾端拉伸，并按采样得到的速度模糊。实心指示块会把下方文字逐像素反色（`mix-blend-mode: difference`），墨色到哪里，文字就在哪里反色。Slider 的每一次步进都由一个临界阻尼弹簧带过去。

### 文字逐字形变

<img src=".github/assets/morph.gif" alt="按钮文字逐字形变、里程表从 999 进位到 1,000、单词切换" width="100%">

`Swap` 会测量每个字形的位置（包括字距调整）。新旧文字共有的字形滑到新位置，其余字形依次滚出、滚入。静止时它就是普通文本，文本选择和屏幕阅读器都不受影响。`NumberFlow` 像里程表一样滚动数字，方向与数值变化一致；进位时，新出现的列和千位逗号原地展开。

### 浮层从锚点方向显现

<img src=".github/assets/surfaces.gif" alt="导出菜单、悬停时展开的通知堆叠、命令面板过滤" width="100%">

菜单与弹出层从展开的那一侧模糊滑入，列表项随后依次进场。Toast 叠成一摞，悬停时展开，可以滑动关闭；`toast.promise` 让同一条通知从“加载中”直接变为“完成”。命令面板支持模糊搜索，高亮会滑到当前项，面板高度随结果数平滑变化。

### 有分量的侧边栏

<img src=".github/assets/sidebar.gif" alt="拖拽侧栏边缘：宽度带阻尼跟随指针，移动时模糊，超出上限有橡皮筋，收起为图标栏" width="100%">

`Sidebar` 的宽度是一个追随指针的阻尼弹簧：内容随边缘速度模糊，超出上下限时有橡皮筋阻力，越过中线松手就收起为带提示的图标栏。宽度和收起状态会被记住。也可以用按钮、`⌘\`、双击或键盘收起。

### 布局重排也有运动

<img src=".github/assets/layout.gif" alt="网格在 2、3、4、6 列之间切换、轮换、增删卡片：每张卡片带动态模糊滑到新位置" width="100%">

用 `LayoutGroup` 包住容器，布局重排时子元素就不再瞬移：断点改变列数、换行、兄弟元素增删时，每个子元素都从原来绘制的位置平移到新位置，并按自身速度加动态模糊。盒子尺寸变化时，里面的文字保持比例、不会被拉伸。`FlowText` 让段落重新折行时的每个单词也这样移动到新的一行。拖动侧栏、缩放窗口这类连续变化保持清晰，只有跳变才会触发动画。

<br/>

## 组件

<picture>
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/components-light.png">
  <img alt="NOIR UI 组件一览" src=".github/assets/components-dark.png" width="100%">
</picture>

| 分组 | |
|---|---|
| **操作** | `Button`（光泽跟随指针 · 模糊涟漪 · 弹簧回弹 · `swapKey` 形变 · `loading` · `magnetic`）· `IconButton` · `Chip` |
| **选择** | `Segmented` · `Tabs`（下划线 / 胶囊）· `NavList` · `Switch` · `Checkbox` · `RadioGroup` · `Slider` |
| **输入** | `Input`（聚焦线从点击处展开）· `Textarea` · `Field` · `Select` |
| **浮层** | `Dialog` · `Drawer` · `Menu` · `Popover` · `Tooltip` · `Command` —— 弹窗打开时页面后退 |
| **反馈** | `toast` + `Toaster` · `Progress` · `ProgressRing` · `Spinner` · `Skeleton` · `Badge` · `StatusDot` · `Kbd` · `Divider` |
| **数据展示** | `Card`（指针聚光）· `Stat` · `NumberFlow` · `Waveform` · `Sparkline` · `LogView` · `Accordion` · `Avatar` · `AvatarGroup` · `BlurText` |
| **布局** | `Sidebar` —— 弹簧阻尼调宽、速度模糊、收起为图标栏 · `LayoutGroup` / `useLayoutMotion` —— 布局重排时子元素带动态模糊平移，不再跳变 · `FlowText` —— 文字重新折行时单词滑到新的一行 |
| **动效** | `Swap` · `Fold` · `PageTransition` · `Thumb` · `useTheme` / `ThemeToggle`（圆形揭示） |
| **Hooks** | `useSmearIndicator` · `usePresence` · `useAnchor` · `useDismiss` · `useListNav` · `useHotkey` · `useRipple` · `useSpotlight` · `useMagnetic` · `useInView` |

<br/>

## 快速开始

```bash
npm install github:HanRabbit/NOIR-UI
```

安装时会自动构建（`prepare`）。对等依赖：`react` 与 `react-dom` ≥ 18。

```jsx
import {useState} from 'react';
import {initTheme, Toaster, toast, Button, Segmented, Sidebar, NavList} from 'noir-ui';
import 'noir-ui/styles.css';

initTheme();            // 读取 localStorage，设置 <html data-theme>

export default function App(){
  const [mode,setMode]=useState('usb');
  return <div style={{display:'flex'}}>
    <Sidebar storageKey="app.side">
      <NavList value="home" items={[{value:'home', label:'Home'}]}/>
    </Sidebar>
    <main data-nr-depth>{/* 弹窗打开时后退 */}
      <Segmented value={mode} onChange={setMode} options={['usb', 'ip']}/>
      <Button variant="primary" swapKey={mode} onClick={()=>toast.success('Connected')}>
        {mode==='usb'?'Connect USB':'Connect IP'}
      </Button>
    </main>
    <Toaster/>
  </div>;
}
```

NOIR 不内置字体。视觉基于 **Inter** 与 **DM Mono** 设计，可以自行加载，或用 `--nr-font` / `--nr-mono` 换成你自己的字体栈。

<br/>

## 运动模型

所有运动都遵循同一套规则（`src/core/motion.js`）。

| | |
|---|---|
| **节奏** | 每类运动一个固定时长：在途移动 `280 ms`、内容切换 `260 ms`、页面 `320 ms`、数字滚动 `300 ms`。距离越远，同样时间里走得越快，拖影也越明显。 |
| **曲线** | `cubic-bezier(.25, .35, .15, 1)`：第一帧就开始移动，速度峰值靠前，点击不会有迟滞感。 |
| **快门** | `拖影 = min(速度 × 48 ms, 已移动距离)`。拖影同时决定拉伸（朝尾端，各种尺寸比例一致）和模糊（`∝ √拖影`，低于约 2 px 时归零，落定清晰）。 |
| **连续** | 打断任意运动时，读取当前帧并从那里继续。 |
| **尊重** | 开启 `prefers-reduced-motion` 时，所有动效都退化为瞬时切换。 |

`EASE`、`DUR`、`smear()`、`sampleEase()` 均已导出，你自己的组件也可以用同样的方式运动。

<br/>

## 主题

所有墨色、圆角、曲线和时长都是 `--nr-*` 自定义属性；`[data-theme="light"]` 与深色完全镜像。

```css
:root{
  --nr-bg:#000; --nr-fg:#fff;
  --nr-fg-2:rgba(255,255,255,.58); --nr-line:rgba(255,255,255,.16);
  --nr-r-sm:7px; --nr-r-md:12px;
  --nr-ease-travel:cubic-bezier(.25,.35,.15,1);
}
```

在应用根节点加上 `data-nr-depth`，打开 Dialog、Drawer 或命令面板时它会缩小并柔化。`useTheme().toggle({x, y})` 会让新主题从该点以圆形展开（View Transitions）。

<br/>

## 开发

```bash
npm install
npm run dev          # 文档与展示站 → http://localhost:5180
npm run build        # 组件库 → dist/noir-ui.js + dist/noir-ui.css
npm run build:docs   # 静态文档 → dist-docs/
```

文档站本身就是用 NOIR 搭建的：有实时工作台、每个分组一页、动效原语页，以及 `⌘K` 命令面板。

在 Chromium（Chrome / Edge）中开发和验证。依赖现代 CSS（`color-mix()`、`:has()`、`mask-composite`、`mix-blend-mode`）与 Web Animations API；不支持 View Transitions 的浏览器会直接切换主题，没有圆形揭示。

<br/>

## 来源

NOIR 起源于 **LeapTracker**（一个 J-Link / RTT 调试工作台）的界面层。其中的原语被抽取、泛化，并扩展为完整的组件系统：

| LeapTracker | NOIR UI |
|---|---|
| `SwapSmear` | `Swap` —— 文本逐字形变，块级内容整层切换 |
| `SegSwitch`、`SegTrack` | `useSmearIndicator` + `Thumb` → Segmented、Tabs、NavList、ListBox、RadioGroup |
| `ClipFold` | `Fold` |
| `DropSelect`、`ActionMenu` | `Select`、`Menu` —— 键盘导航、首字母跳转、列表项依次进场 |
| `NoticeSmear` | `Dialog` —— 焦点陷阱、弹窗层叠、页面后退 |
| 标签页视图切换模糊 | `PageTransition` —— 同轴切换、滚动位置交接 |
| RTT 终端 | `LogView` |

<br/>

<div align="center">
<sub>以黑白制成。</sub>
</div>
