export default {
    data() {
        return {
            devices: [], // 存储搜索到的设备
            isScanning: false // 是否正在扫描
        };
    },
    onLoad() {
        this.startScan(); // 页面加载时开始扫描
    },
    onUnload() {
        this.stopScan(); // 页面卸载时停止扫描
    },
    methods: {
        // 开始扫描设备
        startScan() {
            this.isScanning = true;
            uni.openBluetoothAdapter({
                success: () => {
                    console.log('蓝牙适配器打开成功');
                    this.startBluetoothDiscovery();
                },
                fail: (err) => {
                    console.error('蓝牙适配器打开失败', err);
                    uni.showToast({
                        title: '蓝牙初始化失败',
                        icon: 'none'
                    });
                    this.isScanning = false;
                }
            });
        },

        // 开始蓝牙设备发现
        startBluetoothDiscovery() {
            uni.startBluetoothDevicesDiscovery({
                success: () => {
                    console.log('开始扫描设备');
                    this.listenForDevices();
                },
                fail: (err) => {
                    console.error('扫描失败', err);
                    uni.showToast({
                        title: '扫描失败',
                        icon: 'none'
                    });
                    this.isScanning = false;
                }
            });
        },

        // 监听发现的设备
        listenForDevices() {
            uni.onBluetoothDeviceFound((res) => {
                const newDevices = res.devices.filter(device => {
                    // 过滤掉重复的设备
                    return !this.devices.some(d => d.deviceId === device.deviceId) && (device.localName && device.localName.includes('BT'));
                });
                this.devices.push(...newDevices);
            });
        },

        // 停止扫描
        stopScan() {
            uni.stopBluetoothDevicesDiscovery({
                success: () => {
                    console.log('停止扫描设备');
                    this.isScanning = false;
                },
                fail: (err) => {
                    console.error('停止扫描失败', err);
                }
            });
        },

        // 连接设备
        connectDevice(device) {
            uni.createBLEConnection({
                deviceId: device.deviceId,
                success: () => {
                    console.log('设备连接成功', device);
                    uni.showToast({
                        title: '连接成功',
                        icon: 'success'
                    });
                    
                    // 将设备信息传递回原来的页面
                    const pages = getCurrentPages();
                    const prevPage = pages[pages.length - 2]; // 获取上一个页面实例
                    if (prevPage && prevPage.$vm.onDeviceConnected) {
                        prevPage.$vm.onDeviceConnected(device); // 调用上一个页面的回调方法
                    }

                    // 跳转回原来的页面
                    uni.navigateBack({
                        delta: 1
                    });


                },
                fail: (err) => {
                    console.error('设备连接失败', err);
                    uni.showToast({
                        title: '连接失败',
                        icon: 'none'
                    });
                }
            });
        }
    }
};