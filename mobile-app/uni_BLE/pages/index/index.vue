<template>
  <scroll-view scroll-y class="page-content">
    <div v-if="connectedDevice">
      <button class="rescan-button" @click="startScan">重新选择设备</button>
      <view class="container">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <text class="text-style">已连接设备名称: {{ connectedDevice.localName || connectedDevice.name }}\n</text>
            <text class="text-style">已连接设备地址: {{ connectedDevice.deviceId }}\n</text>
          </div>
          <div>
            <button class="set-button" @click="Show_BLE_information">设备信息</button>
          </div>
        </div>
      </view>
    </div>
    
    <div v-if="!connectedDevice">
      <button class="scan-button" @click="startScan">扫描BLE设备</button>
      <text class="text-style">未连接设备</text>
    </div>

    <div class="container">
      <h1>实时环境监测数据</h1>
      <view class="drawChart-container">
        <view>
          <canvas canvas-id="lineChart" id="lineChart" style="width: 100%; height: 300px;"></canvas>
        </view>
      </view>
    </div>

    <view v-if="weatherData">
      <view class="container">
        <text class="text-style">当前温度: {{ weatherData.current.temp_c }}°C\n</text>
        <text class="text-style">当前湿度: {{ weatherData.current.humidity }}%\n</text>
        <text class="text-style">位置: {{ weatherData.location.name }}, {{ weatherData.location.region }}, {{ weatherData.location.country }}\n</text>
        <text class="text-style">最后更新: {{ formatDate(weatherData.current.last_updated) }}\n</text>
        <text class="text-style" v-if="updateTimer">下一次自动更新: {{ nextUpdateTime }}秒后</text>
      </view>
    </view>

    <view class="container">
      <div style="display: flex; justify-content: space-between;">
        <input v-model="tempThreshold" type="number" placeholder="温度阈值(°C)" />
        <button class="set-button" @click="setTempThreshold">设置温度阈值</button>
      </div>
    </view>

    <view class="container">
      <div style="display: flex; justify-content: space-between;">
        <input v-model="humidityThreshold" type="number" placeholder="湿度阈值(%)" />
        <button class="set-button" @click="setHumidityThreshold">设置湿度阈值</button>
      </div>
    </view>

    <button class="manual-update-button" @click="manualUpdate">
      <text class="button-text">手动更新数据</text>
    </button>

    <!-- 左转和右转按钮 -->
    <view class="container">
      <div style="display: flex; justify-content: space-between;">
        <button class="set-button" @click="turnLeft">左转</button>
        <button class="set-button" @click="turnRight">右转</button>
      </div>
    </view>

    <!-- 电池电压按钮 -->
    <view class="container">
      <button class="set-button" style="height: 40px; width: 200px;" @click="getBatteryVoltage">电池电压</button>
	<!-- 倘若需要通过状态条件触发显示就在下面这一行加上这个前缀 v-if="batteryVoltage !== null" -->
      <view  class="container mt-2">
        <text class="text-style">电池电压: {{ batteryVoltage }}V</text>
      </view>
    </view>

    <view style="height: 60px;"></view>
  </scroll-view>

  <div class="bottom-nav">
    <div class="nav-item" @click="mode('environment')">
      <div class="icon">&#xe600;</div>
      <span>环境监测</span>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      connectedDevice: null,
      services: [],
      indexService: null,
      tempDataPoints: [],
      humidityDataPoints: [],
      tempThreshold: 25,
      humidityThreshold: 60,
      weatherData: null,
      weatherApiKey: 'YOUR_WEATHER_API_KEY',
      isLoading: false,
      updateTimer: null,
      nextUpdateTime: 300,
      batteryVoltage: null,
      // 蓝牙通信相关配置
      COMMUNICATION_SERVICE_UUID: '0000FFE0-0000-1000-8000-00805F9B34FB',
      COMMUNICATION_CHAR_UUID: '0000FFE1-0000-1000-8000-00805F9B34FB',
      isBleNotifyEnabled: false
    };
  },

  methods: {
    startScan() {
      uni.navigateTo({ url: '/pages/index/deviceList' });
    },

    Show_BLE_information() {
      uni.navigateTo({
        url: '/pages/index/BLE_information'
      }).then(() => {
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        if (currentPage && currentPage.$vm.receiveDevice) {
          currentPage.$vm.receiveDevice(this.connectedDevice);
        }
      });
    },

    onDeviceConnected(device) {
      this.connectedDevice = device;
      uni.showToast({
        title: `已连接设备：${device.localName || device.name}`,
        icon: 'none'
      });
      this.getDeviceServices();
      this.updateWeatherData();
      this.initCommunication(); // 初始化蓝牙通信
    },

    // 初始化蓝牙通信
    initCommunication() {
      if (!this.connectedDevice) return;
      
      // 启用通知功能
      uni.notifyBLECharacteristicValueChange({
        deviceId: this.connectedDevice.deviceId,
        serviceId: this.COMMUNICATION_SERVICE_UUID,
        characteristicId: this.COMMUNICATION_CHAR_UUID,
        state: true,
        success: () => {
          console.log('蓝牙通知已启用');
          this.isBleNotifyEnabled = true;
          
          // 监听蓝牙数据变化
          uni.onBLECharacteristicValueChange((res) => {
            if (res.serviceId === this.COMMUNICATION_SERVICE_UUID &&
                res.characteristicId === this.COMMUNICATION_CHAR_UUID) {
              this.handleBleData(res.value);
            }
          });
        },
        fail: (err) => {
          console.error('启用蓝牙通知失败', err);
        }
      });
    },

    // 处理蓝牙接收的数据
    handleBleData(buffer) {
      try {
        // 将 ArrayBuffer 转换为字符串
        const receivedData = this.arrayBufferToString(buffer);
        console.log('原始接收数据:', receivedData); // 打印原始数据用于调试
        
        // 从字符串中提取电压值
        // 匹配类似 "12.02" 的数字模式
        const match = receivedData.match(/[\d\.]+/);
        
        if (match && match.length > 0) {
          const voltageValue = parseFloat(match[0]);
          
          if (!isNaN(voltageValue)) {
            this.batteryVoltage = voltageValue.toFixed(2); // 保留两位小数
            uni.showToast({ title: `电池电压: ${this.batteryVoltage}V` });
          } else {
            console.error('解析电池电压失败，提取的数值无效', match[0]);
            uni.showToast({ title: '解析数据失败', icon: 'none' });
          }
        } else {
          console.error('解析电池电压失败，未找到数值部分', receivedData);
          uni.showToast({ title: '解析数据失败', icon: 'none' });
        }
      } catch (error) {
        console.error('处理蓝牙数据出错', error);
        uni.showToast({ title: '数据处理错误', icon: 'none' });
      }
    },

    // ArrayBuffer 转字符串的工具函数
    arrayBufferToString(buffer) {
      const uint8Array = new Uint8Array(buffer);
      let str = '';
      
      for (let i = 0; i < uint8Array.length; i++) {
        str += String.fromCharCode(uint8Array[i]);
      }
      
      // 如果需要更完整的 UTF-8 支持，可以使用以下方法
      // 但对于简单的 ASCII 字符串，上面的方法已经足够
      // return decodeURIComponent(escape(str));
      
      return str;
    },

    getDeviceServices() {
      setTimeout(() => {
        uni.getBLEDeviceServices({
          deviceId: this.connectedDevice.deviceId,
          success: (res) => {
            this.services = res.services;
            console.log('获取服务成功', res);
          },
          fail: (err) => {
            console.log('获取服务失败', err);
          }
        });
      }, 1000);
    },

    // 获取电池电压（发送"5"指令）
    getBatteryVoltage() {
      if (!this.connectedDevice) {
        uni.showToast({ title: '未连接蓝牙设备', icon: 'none' });
        return;
      }
      
      if (!this.isBleNotifyEnabled) {
        // 如果通知未启用，先初始化通信
        this.initCommunication();
        setTimeout(() => this.sendBatteryCommand(), 500);
      } else {
        // 直接发送指令
        this.sendBatteryCommand();
      }
    },

    // 发送电池指令
    sendBatteryCommand() {
      this.sendDataToBLE('5');
      uni.showToast({ title: '正在获取电池电压...' });
    },

    // 向蓝牙设备发送数据
    sendDataToBLE(data) {
      const buffer = new ArrayBuffer(1);
      const dataView = new DataView(buffer);
      dataView.setUint8(0, parseInt(data));

      uni.writeBLECharacteristicValue({
        deviceId: this.connectedDevice.deviceId,
        serviceId: this.COMMUNICATION_SERVICE_UUID,
        characteristicId: this.COMMUNICATION_CHAR_UUID,
        value: buffer,
        success: () => {
          console.log('数据发送成功:', data);
        },
        fail: (err) => {
          console.error('数据发送失败', err);
          uni.showToast({ title: '指令发送失败', icon: 'none' });
        }
      });
    },

    // 其他原有方法保持不变...
    async updateWeatherData(isManual = false) {
      if (this.isLoading) return;
      
      this.isLoading = true;
      if (isManual) {
        uni.showLoading({ title: '更新中...' });
      }
      
      try {
        const position = await new Promise((resolve, reject) => {
          uni.getLocation({
            type: 'wgs84',
            success: resolve,
            fail: reject
          });
        });
        
        const response = await uni.request({
          url: `https://api.weatherapi.com/v1/current.json?key=${this.weatherApiKey}&q=${position.latitude},${position.longitude}`,
          method: 'GET'
        });
        
        if (response.statusCode === 200) {
          this.weatherData = response.data;
          
          const temperature = this.weatherData.current.temp_c;
          const humidity = this.weatherData.current.humidity;
          
          this.tempDataPoints.push(temperature);
          this.humidityDataPoints.push(humidity);
          
          if (this.tempDataPoints.length > 50) {
            this.tempDataPoints.shift();
            this.humidityDataPoints.shift();
          }
          
          this.drawChart();
          
          if (isManual) {
            uni.showToast({
              title: '数据已更新',
              icon: 'success'
            });
          }
          
          this.checkThresholds();
        } else {
          console.error('获取天气数据失败', response);
          uni.showToast({
            title: '获取数据失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('获取天气数据出错', error);
        uni.showToast({
          title: '更新失败，请重试',
          icon: 'none'
        });
      } finally {
        this.isLoading = false;
        if (isManual) {
          uni.hideLoading();
        }
      }
    },

    manualUpdate() {
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
      }
      this.nextUpdateTime = 300;
      this.startUpdateTimer();
      this.updateWeatherData(true);
    },

    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString();
    },

    drawChart() {
      const ctx = uni.createCanvasContext('lineChart', this);
      const chartWidth = 300;
      const chartHeight = 300;
      const margin = 30; // 边距
      const space = (chartWidth - 2 * margin) / (Math.max(1, this.tempDataPoints.length - 1));

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // 绘制坐标轴
      this.drawAxes(ctx, chartWidth, chartHeight, margin);

      // 绘制温度曲线（红色）
      ctx.beginPath();
      ctx.moveTo(margin, this.getYPosition(this.tempDataPoints[0], 0, 40, chartHeight, margin));
      
      for (let i = 1; i < this.tempDataPoints.length; i++) {
        ctx.lineTo(margin + i * space, this.getYPosition(this.tempDataPoints[i], 0, 40, chartHeight, margin));
      }
      
      ctx.setStrokeStyle('#E53935');
      ctx.setLineWidth(2);
      ctx.stroke();

      // 绘制湿度曲线（蓝色）
      ctx.beginPath();
      ctx.moveTo(margin, this.getYPosition(this.humidityDataPoints[0], 0, 100, chartHeight, margin));
      
      for (let i = 1; i < this.humidityDataPoints.length; i++) {
        ctx.lineTo(margin + i * space, this.getYPosition(this.humidityDataPoints[i], 0, 100, chartHeight, margin));
      }
      
      ctx.setStrokeStyle('#1E88E5');
      ctx.setLineWidth(2);
      ctx.stroke();

      // 绘制温度阈值线
      ctx.beginPath();
      ctx.setStrokeStyle('#E53935');
      ctx.setLineWidth(1);
      const tempY = this.getYPosition(this.tempThreshold, 0, 40, chartHeight, margin);
      ctx.moveTo(margin, tempY);
      ctx.lineTo(chartWidth - margin, tempY);
      ctx.fillText(`温度阈值: ${this.tempThreshold}°C`, margin + 5, tempY - 5);
      ctx.stroke();

      // 绘制湿度阈值线
      ctx.beginPath();
      ctx.setStrokeStyle('#1E88E5');
      ctx.setLineWidth(1);
      const humidityY = this.getYPosition(this.humidityThreshold, 0, 100, chartHeight, margin);
      ctx.moveTo(margin, humidityY);
      ctx.lineTo(chartWidth - margin, humidityY);
      ctx.fillText(`湿度阈值: ${this.humidityThreshold}%`, chartWidth - margin - 80, humidityY - 5);
      ctx.stroke();

      // 添加图例
      ctx.setFontSize(10);
      ctx.fillText('温度(°C)', chartWidth - 70, 20);
      ctx.fillText('湿度(%)', chartWidth - 70, 40);
      
      ctx.beginPath();
      ctx.setFillStyle('#E53935');
      ctx.fillRect(chartWidth - 85, 15, 10, 5);
      
      ctx.beginPath();
      ctx.setFillStyle('#1E88E5');
      ctx.fillRect(chartWidth - 85, 35, 10, 5);
      
      ctx.draw();
    },

    // 辅助函数：计算Y轴位置
    getYPosition(value, min, max, chartHeight, margin) {
      const availableHeight = chartHeight - 2 * margin;
      const range = max - min;
      const y = chartHeight - margin - ((value - min) / range * availableHeight);
      return Math.max(margin, Math.min(chartHeight - margin, y));
    },

    // 绘制坐标轴
    drawAxes(ctx, chartWidth, chartHeight, margin) {
      // 绘制X轴
      ctx.beginPath();
      ctx.setStrokeStyle('#CCCCCC');
      ctx.setLineWidth(1);
      ctx.moveTo(margin, chartHeight - margin);
      ctx.lineTo(chartWidth - margin, chartHeight - margin);
      ctx.stroke();

      // 绘制左侧Y轴（温度）
      ctx.beginPath();
      ctx.moveTo(margin, margin);
      ctx.lineTo(margin, chartHeight - margin);
      ctx.stroke();
      
      // 绘制右侧Y轴（湿度）
      ctx.beginPath();
      ctx.moveTo(chartWidth - margin, margin);
      ctx.lineTo(chartWidth - margin, chartHeight - margin);
      ctx.stroke();

      // 添加Y轴标签
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      // ctx.fillText('温度(°C)', margin / 2, chartHeight / 2);
      // ctx.fillText('湿度(%)', chartWidth - margin / 2, chartHeight / 2);

      // 添加Y轴刻度（温度）
      for (let i = 0; i <= 4; i++) {
        const y = chartHeight - margin - (i * (chartHeight - 2 * margin) / 4);
        const value = i * 10;
        
        ctx.beginPath();
        ctx.moveTo(margin - 5, y);
        ctx.lineTo(margin, y);
        ctx.stroke();
        
        ctx.setTextAlign('right');
        ctx.fillText(value, margin - 8, y + 3);
      }

      // 添加Y轴刻度（湿度）
      for (let i = 0; i <= 5; i++) {
        const y = chartHeight - margin - (i * (chartHeight - 2 * margin) / 5);
        const value = i * 20;
        
        ctx.beginPath();
        ctx.moveTo(chartWidth - margin, y);
        ctx.lineTo(chartWidth - margin + 5, y);
        ctx.stroke();
        
        ctx.setTextAlign('left');
        ctx.fillText(value, chartWidth - margin + 8, y + 3);
      }
    },

    setTempThreshold() {
      if (this.tempThreshold && !isNaN(this.tempThreshold)) {
        this.tempThreshold = parseFloat(this.tempThreshold);
        this.drawChart();
        uni.showToast({
          title: `温度阈值已设置为 ${this.tempThreshold}°C`,
          icon: 'none'
        });
      } else {
        uni.showToast({
          title: '请输入有效温度值',
          icon: 'none'
        });
      }
    },

    setHumidityThreshold() {
      if (this.humidityThreshold && !isNaN(this.humidityThreshold)) {
        this.humidityThreshold = parseFloat(this.humidityThreshold);
        this.drawChart();
        uni.showToast({
          title: `湿度阈值已设置为 ${this.humidityThreshold}%`,
          icon: 'none'
        });
      } else {
        uni.showToast({
          title: '请输入有效湿度值',
          icon: 'none'
        });
      }
    },

    checkThresholds() {
      if (this.weatherData && this.weatherData.current.temp_c > this.tempThreshold) {
        uni.showToast({
          title: `警告: 温度过高 (${this.weatherData.current.temp_c}°C)`,
          icon: 'none'
        });
      }
      
      if (this.weatherData && this.weatherData.current.humidity > this.humidityThreshold) {
        uni.showToast({
          title: `警告: 湿度过高 (${this.weatherData.current.humidity}%)`,
          icon: 'none'
        });
      }
    },

    clean() {
      this.tempDataPoints = [];
      this.humidityDataPoints = [];
      this.drawChart();
    },

    mode(mode) {
      console.log('切换模式:', mode);
      if (mode === 'environment') {
        this.tempThreshold = 25;
        this.humidityThreshold = 60;
        this.drawChart();
      }
    },

    startUpdateTimer() {
      this.updateTimer = setInterval(() => {
        this.nextUpdateTime--;
        
        if (this.nextUpdateTime <= 0) {
          this.nextUpdateTime = 300;
          this.updateWeatherData();
        }
      }, 1000);
    },

    // 左转按钮点击事件
    turnLeft() {
      if (this.connectedDevice) {
        this.sendDataToBLE('1');
      } else {
        uni.showToast({
          title: '未连接蓝牙设备',
          icon: 'none'
        });
      }
    },

    // 右转按钮点击事件
    turnRight() {
      if (this.connectedDevice) {
        this.sendDataToBLE('2');
      } else {
        uni.showToast({
          title: '未连接蓝牙设备',
          icon: 'none'
        });
      }
    },
  },
  
  onLoad() {
    this.updateWeatherData();
    this.startUpdateTimer();
  },
  
  onUnload() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    // 关闭蓝牙连接
    if (this.connectedDevice) {
      uni.closeBLEConnection({
        deviceId: this.connectedDevice.deviceId
      });
    }
  }
};
</script>

<style scoped>
@import url("./index.css");

.page-content {
  height: calc(100vh - 60px);
}

.manual-update-button {
  background-color: #1E88E5;
  color: white;
  border-radius: 5px;
  padding: 10px;
  text-align: center;
  margin: 15px;
}

.button-text {
  font-size: 16px;
}

.bottom-nav {
  display: flex;
  justify-content: center;
  background-color: #f8f8f8;
  border-top: 1px solid #e0e0e0;
  padding: 10px 0;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #555;
  text-decoration: none;
}

.icon {
  font-size: 20px;
  margin-bottom: 5px;
}

.mt-2 {
  margin-top: 8px;
}
</style>
