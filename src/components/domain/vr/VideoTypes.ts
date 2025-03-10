export const VideoTypes = [
  {
    name: "VR 360 (2D 单眼) 等距",
    method: "createEquirectLayer",
    config: {
      centralHorizontalAngle: 2 * Math.PI,
      radius: 1,
      layout: "mono"
    }
  },
  {
    "name": "VR 360 (2D) 柱狀",
    "method": "createCylinderLayer",
    "config": {
      "centralAngle": Math.PI * 2,
      "aspectRatio": 2.0,
      "layout": "mono"
    }
  },
  {
    "name": "VR 360 (2D - Cylinder Layer) 柱狀",
    "method": "createCylinderLayer",
    "config": {
      "centralAngle": Math.PI * 2,
      "aspectRatio": 16.0 / 9.0,
      "layout": "mono"
    }
  },
];