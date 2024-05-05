import * as T from "../CS559-Three/build/three.module.js";
import { GrObject } from "../CS559-Framework/GrObject.js";
import * as Loaders from "../CS559-Framework/loaders.js";

export class Fish extends Loaders.FbxGrObject {
  constructor(params = {}) {
    super({
      fbx: params.fbx || "./fish.fbx", // 指定模型文件
      norm: 2.0,
      name: "Fish",
    });
    this.scaleSize = params.scaleSize || 1;
    this.speed = params.speed || 0.001; // 调整鱼的游动速度
    this.moveTime = 0;
    this.waitTime = 0;
    this.isMoving = true;
    this.groundPlaneSize = params.groundPlaneSize || 10; // 如果鱼在某种地面上移动，设置大小
    this.setRandomTarget(); // 设置随机目标位置
  }

  setRandomTarget() {
    const minX = -10;
    const maxX = 10;
    const minY = -5;
    const maxY = 5;
    const minZ = -10;
    const maxZ = 10;
    
    const x = Math.random() * (maxX - minX) + minX;
    const y = Math.random() * (maxY - minY) + minY;
    const z = Math.random() * (maxZ - minZ) + minZ;
    
    this.targetPosition = new T.Vector3(x, y, z);
  }

  stepWorld(delta, timeOfDay) {
    if (this.isMoving) {
      const stepSize = this.speed * delta;
      this.objects[0].position.lerp(this.targetPosition, stepSize);
      if (this.objects[0].position.distanceTo(this.targetPosition) < 0.5) {
        this.isMoving = false;
        this.waitTime = Math.random() * 3000 + 1000; // 在1到3秒之间随机等待再次移动
        this.moveTime = 0;
      }
    } else {
      this.moveTime += delta;
      if (this.moveTime > this.waitTime) {
        this.isMoving = true;
        this.moveTime = 0;
        this.setRandomTarget(); // 设定新的随机目标位置
      }
    }

    // 维持对象的缩放比例
    this.objects[0].scale.set(this.scaleSize, this.scaleSize, this.scaleSize);

    // 可选：调整对象面向移动方向
    let direction = new T.Vector3().subVectors(this.targetPosition, this.objects[0].position).normalize();
    this.objects[0].lookAt(this.objects[0].position.clone().add(direction));
  }
}
