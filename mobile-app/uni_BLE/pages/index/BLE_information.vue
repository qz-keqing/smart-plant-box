<template>
    <view class="container">
        <!-- 显示蓝牙设备信息的代码 -->
        <view v-if="connectedDevice">
            <text>设备名称: {{ connectedDevice.localName || connectedDevice.name }}</text>
            <view v-for="(service, index) in services" :key="index" class="container">
                <text>服务uuid: {{ service.uuid }}\n</text>
                <text>isprimary: {{ service.isPrimary }}\n</text>
                <view v-for="(characteristic, index) in service.characteristics" :key="index" class="container">
                    <text>特征值uuid: {{ characteristic.uuid }}\n</text>
                    <text>properties: {{ characteristic.properties }}\n</text>
                    <text>value: {{ characteristic.value }}\n</text>
                </view>
            </view>
            <text>其中用于通信的服务uuid: </text>
            <view v-for="uuid in connectedDevice.advertisServiceUUIDs" :key="uuid" class="container">
                <text>服务uuid: {{ uuid }}</text>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'BLE_information',
    
    data() {
        return {
            services: [], // 存储蓝牙设备的服务信息
            connectedDevice: null, // 存储接收到的蓝牙设备信息
        };
    },

    methods: {
        receiveDevice(device) {
            this.connectedDevice = device;
            this.getServices();
        },

        getServices() {
            uni.getBLEDeviceServices({
                deviceId: this.connectedDevice.deviceId,
                success: (res) => {
                    this.services = res.services;
                    console.log('获取服务成功', res);
                    this.getCharacteristics();
                },
            })
        },

        getCharacteristics() {
            for (let i = 0; i < this.services.length; i++) {
                uni.getBLEDeviceCharacteristics({
                    deviceId: this.connectedDevice.deviceId,
                    serviceId: this.services[i].uuid,
                    success: (res) => {
                        this.services[i].characteristics = res.characteristics;
                        console.log('获取特征值成功', res);
                    },
                    fail: (err) => {
                        console.log('获取特征值失败', err);
                    }
                })
            }
        },
    },
}
</script>
<style scoped>
@import url("./index.css");
</style>
