# 光伏智能种植盒 / BLE_QZ

这是一个基于 uni-app 的蓝牙控制 App，用于连接 BLE 设备、读取环境数据，并向设备发送控制参数。

## 功能

- BLE 设备扫描与连接
- 温度、湿度数据展示
- 环境数据曲线展示
- 温度和湿度阈值设置
- 电池电压读取
- 设备控制命令发送
- 基于定位获取天气数据（需要自行配置 WeatherAPI 密钥）

## 项目结构

```text
mobile-app/uni_BLE/    uni-app App 源码
docs/                  项目说明文档
```

## 开发环境

- HBuilderX
- uni-app
- Android 设备，并开启蓝牙和定位权限
- 与代码中服务 UUID、特征值 UUID 匹配的 BLE 设备

## 导入与运行

1. 使用 HBuilderX 导入 `mobile-app/uni_BLE`。
2. 在 `mobile-app/uni_BLE/manifest.json` 中配置你自己的 uni-app AppID。
3. 在 `mobile-app/uni_BLE/pages/index/index.vue` 中配置 WeatherAPI 密钥；不要把真实密钥提交到 Git。
4. 根据你的硬件修改 BLE 服务 UUID、特征值 UUID 和数据协议。
5. 连接 Android 设备后运行到真机。

## 蓝牙协议

当前工程中的 UUID 和数据帧属于本项目硬件实现的一部分。正式使用前，请根据你的固件协议检查：

- 服务 UUID
- 读特征值 UUID
- 写特征值 UUID
- 数据端序
- 命令字
- 温湿度和电池电压的数据编码

## 注意事项

- 本仓库只包含本项目 App 源码，不包含 `unpackage` 构建产物、APK、比赛报告、授权书、签名图片或第三方芯片资料。
- RA8D1 开发库及其示例工程属于第三方内容，未复制到本仓库；使用时请遵守原始发行包中的许可证。
- WeatherAPI 密钥属于敏感配置，应通过本地配置或构建环境注入。

## License

本项目自有代码采用 MIT License，第三方依赖按照其各自许可证执行。
