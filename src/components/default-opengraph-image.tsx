import Logo from "@/components/icons/logo";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CSSProperties } from "react";

type TProps = {
  logoSize?: number;
};

export const logoAspectRatio = 99 / 24;
export const background = "hsl(120 9% 6%)";
export const foreground = "hsl(120 100% 97%)";
export const foregroundMuted = "hsl(120 6% 65%)";
export const backgroundHover = "hsl(120 9% 7%)";

export const opengraphSize = {
  width: 1200,
  height: 630,
};
export const opengraphContentType = "image/png";
export const defaultParagraphClassName: CSSProperties = {
  wordBreak: "break-word",
  textWrap: "balance",
};

export default function DefaultOpenGraphImage({ logoSize = 544 }: TProps) {
  return (
    <div
      style={{
        background: background,
        color: foreground,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1200"
        height="630"
        fill="none"
        viewBox="0 0 1200 630"
        style={{
          width: 1200,
          height: 630,
          color: backgroundHover,
          position: "absolute",
          left: 0,
          top: 0,
        }}
      >
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M1194.61 0h-20.6c12.73 9.565 22.09 23.37 25.99 39.318V6.674A83 83 0 0 0 1194.61 0m5.39 98V84h-82V56c0-7.732 6.27-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.54-28-28-28s-28 12.536-28 28v32.78a83.7 83.7 0 0 0-14 6.458V56c0-23.196 18.8-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.07-56-56-56s-56 25.072-56 56v28h-14V55.983c.01-22.891 11-43.215 27.99-55.983h-20.6a85 85 0 0 0-7.39 9.55 84 84 0 0 0-7 12.826A84 84 0 0 0 1040.61 0h-20.6c17 12.771 27.99 33.102 27.99 56v28h-84V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42 23.2 0 42 18.804 42 42v14h14V56c0-30.928-25.07-56-56-56-30.928 0-56 25.072-56 56v28h-14V55.984c.005-22.892 10.999-43.216 27.993-55.984h-20.604A84 84 0 0 0 908 9.55a84 84 0 0 0-7 12.826A84 84 0 0 0 886.611 0h-20.604C883.005 12.771 894 33.102 894 56v28h-84V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14V55.984c.005-22.892 10.999-43.216 27.993-55.984h-20.604A84 84 0 0 0 754 9.55a84 84 0 0 0-7 12.826A84 84 0 0 0 732.611 0h-20.604C729.005 12.771 740 33.102 740 56v28h-84V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14V55.983c.005-22.891 10.999-43.215 27.993-55.983h-20.604A84 84 0 0 0 600 9.55a84 84 0 0 0-7 12.826A84 84 0 0 0 578.611 0h-20.604C575.005 12.771 586 33.102 586 56v28h-84V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14V55.984c.005-22.892 10.999-43.216 27.993-55.984h-20.604A84 84 0 0 0 446 9.55a84 84 0 0 0-7 12.826A84 84 0 0 0 424.611 0h-20.604C421.005 12.771 432 33.102 432 56v28h-84V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14V55.984c.005-22.892 10.999-43.216 27.993-55.984h-20.604A84 84 0 0 0 292 9.55a84 84 0 0 0-7 12.826A84 84 0 0 0 270.611 0h-20.604C267.005 12.771 278 33.102 278 56v28h-84V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14V55.984c.005-22.892 10.999-43.216 27.993-55.984h-20.604A84 84 0 0 0 138 9.55a84 84 0 0 0-7 12.826A84 84 0 0 0 116.611 0H96.007C113.005 12.771 124 33.102 124 56v28H40V56c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14V56c0-15.464-12.536-28-28-28S26 40.536 26 56v32.78a83.6 83.6 0 0 0-14 6.458V56c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14V56c0-30.928-25.072-56-56-56C28.226 0 6.52 17.412 0 41.114V98h7.55A84 84 0 0 0 0 103.655v19.8C12.84 107.908 32.263 98 54 98c38.66 0 70 31.34 70 70v28H40v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.5 83.5 0 0 0-14 6.458V168c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56-25.774 0-47.48 17.412-54 41.114V210h7.55A84 84 0 0 0 0 215.655v19.8C12.84 219.908 32.263 210 54 210c38.66 0 70 31.34 70 70v28H40v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.5 83.5 0 0 0-14 6.458V280c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56-25.774 0-47.48 17.412-54 41.114V322h7.55A84 84 0 0 0 0 327.655v19.8C12.84 331.908 32.263 322 54 322c38.66 0 70 31.34 70 70v28H40v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.5 83.5 0 0 0-14 6.458V392c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56-25.774 0-47.48 17.412-54 41.114V434h7.55A84 84 0 0 0 0 439.655v19.8C12.84 443.908 32.263 434 54 434c38.66 0 70 31.34 70 70v28H40v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.5 83.5 0 0 0-14 6.458V504c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56-25.774 0-47.48 17.412-54 41.114V546h7.55A84 84 0 0 0 0 551.655v19.8C12.84 555.908 32.263 546 54 546c38.66 0 70 31.34 70 70v14h14v-14.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70v14h14v-14.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70v14h14v-14.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70v14h14v-14.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70v14h14v-14.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70v14h14v-14.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70v14h14v-14.016c.01-38.653 31.35-69.984 70-69.984 32.91 0 60.52 22.712 68 53.318v-32.644A84.4 84.4 0 0 0 1178.45 546H1200v-14h-82v-28c0-7.732 6.27-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.54-28-28-28s-28 12.536-28 28v32.78a83.7 83.7 0 0 0-14 6.458V504c0-23.196 18.8-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56s-56 25.072-56 56v28h-14v-28.016c.01-38.653 31.35-69.984 70-69.984 32.91 0 60.52 22.712 68 53.318v-32.644A84.4 84.4 0 0 0 1178.45 434H1200v-14h-82v-28c0-7.732 6.27-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.54-28-28-28s-28 12.536-28 28v32.78a83.7 83.7 0 0 0-14 6.458V392c0-23.196 18.8-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56s-56 25.072-56 56v28h-14v-28.016c.01-38.653 31.35-69.984 70-69.984 32.91 0 60.52 22.712 68 53.318v-32.644A84.4 84.4 0 0 0 1178.45 322H1200v-14h-82v-28c0-7.732 6.27-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.54-28-28-28s-28 12.536-28 28v32.78a83.7 83.7 0 0 0-14 6.458V280c0-23.196 18.8-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56s-56 25.072-56 56v28h-14v-28.016c.01-38.653 31.35-69.984 70-69.984 32.91 0 60.52 22.712 68 53.318v-32.644A84.4 84.4 0 0 0 1178.45 210H1200v-14h-82v-28c0-7.732 6.27-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.54-28-28-28s-28 12.536-28 28v32.78a83.7 83.7 0 0 0-14 6.458V168c0-23.196 18.8-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56s-56 25.072-56 56v28h-14v-28.016c.01-38.653 31.35-69.984 70-69.984 32.91 0 60.52 22.712 68 53.318v-32.644A84.4 84.4 0 0 0 1178.45 98zm-12 532v-14c0-30.928-25.07-56-56-56s-56 25.072-56 56v14h14v-14c0-23.196 18.8-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.54-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.27-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.07-56-56-56-30.928 0-56 25.072-56 56v14h14v-14c0-23.196 18.804-42 42-42 23.2 0 42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v14h14v-14c0-23.196 18.804-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v14h14v-14c0-23.196 18.804-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v14h14v-14c0-23.196 18.804-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v14h14v-14c0-23.196 18.804-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v14h14v-14c0-23.196 18.804-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zm-126 0v-14c0-30.928-25.072-56-56-56-25.774 0-47.48 17.412-54 41.114V630h12v-14c0-23.196 18.804-42 42-42s42 18.804 42 42v14zm-28 0v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v14h14v-14c0-7.732 6.268-14 14-14s14 6.268 14 14v14zM0 11.455A70.4 70.4 0 0 1 11.993 0H0zm1055 570.921a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 1085.55 546h-61.1c13.37 8.891 24.05 21.511 30.55 36.376M1048 532h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V504c0-23.196 18.804-42 42-42 23.2 0 42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56-30.928 0-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70zm-177.551 14h61.102A84.4 84.4 0 0 0 908 569.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M894 504c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V532h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V504c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 777.551 546zM740 504v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V504c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 600 569.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M586 504c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V532h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V504c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 469.551 546zM432 504v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V504c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 292 569.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M278 504c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V532h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V504c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-147 78.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 161.551 546h-61.102c13.372 8.891 24.051 21.511 30.551 36.376m924-112a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 1085.55 434h-61.1c13.37 8.891 24.05 21.511 30.55 36.376M1048 392v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V392c0-23.196 18.804-42 42-42 23.2 0 42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56-30.928 0-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 908 457.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M894 392c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V420h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V392c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 777.551 434zM740 392v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V392c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 600 457.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M586 392c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V420h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V392c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 469.551 434zM432 392v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V392c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 292 457.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M278 392c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V420h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V392c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-147 78.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 161.551 434h-61.102c13.372 8.891 24.051 21.511 30.551 36.376m924-112a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 1085.55 322h-61.1c13.37 8.891 24.05 21.511 30.55 36.376M1048 280v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V280c0-23.196 18.804-42 42-42 23.2 0 42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56-30.928 0-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 908 345.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M894 280c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V308h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V280c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 777.551 322zM740 280v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V280c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 600 345.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M586 280c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V308h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V280c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 469.551 322zM432 280v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V280c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016c.009-38.653 31.346-69.984 70-69.984 38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 292 345.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M278 280c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V308h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V280c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-147 78.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 161.551 322h-61.102c13.372 8.891 24.051 21.511 30.551 36.376m924-112a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 1085.55 210h-61.1c13.37 8.891 24.05 21.511 30.55 36.376M1048 168v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V168c0-23.196 18.804-42 42-42 23.2 0 42 18.804 42 42v14h14v-14c0-30.928-25.07-56-56-56-30.928 0-56 25.072-56 56v28h-14v-28.016C908.009 129.331 939.346 98 978 98c38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 908 233.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M894 168c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V196h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V168c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 777.551 210zM740 168v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V168c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016C600.009 129.331 631.346 98 670 98c38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 600 233.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M586 168c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V196h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V168c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-177.551 42c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 469.551 210zM432 168v28h-84v-28c0-7.732 6.268-14 14-14s14 6.268 14 14v14h14v-14c0-15.464-12.536-28-28-28s-28 12.536-28 28v32.78a83.6 83.6 0 0 0-14 6.458V168c0-23.196 18.804-42 42-42s42 18.804 42 42v14h14v-14c0-30.928-25.072-56-56-56s-56 25.072-56 56v28h-14v-28.016C292.009 129.331 323.346 98 362 98c38.66 0 70 31.34 70 70m-177.551 42h61.102A84.4 84.4 0 0 0 292 233.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M278 168c0-38.66-31.34-70-70-70-38.654 0-69.991 31.331-70 69.984V196h14v-28c0-30.928 25.072-56 56-56s56 25.072 56 56v14h-14v-14c0-23.196-18.804-42-42-42s-42 18.804-42 42v39.238a83.6 83.6 0 0 1 14-6.458V168c0-15.464 12.536-28 28-28s28 12.536 28 28v14h-14v-14c0-7.732-6.268-14-14-14s-14 6.268-14 14v28h84zm-147 78.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 161.551 210h-61.102c13.372 8.891 24.051 21.511 30.551 36.376m924-112a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 1085.55 98h-61.1c13.37 8.891 24.05 21.511 30.55 36.376M870.449 98h61.102A84.4 84.4 0 0 0 908 121.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376m-154 0c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 777.551 98zm-154 0h61.102A84.4 84.4 0 0 0 600 121.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376m-154 0c13.372 8.891 24.051 21.511 30.551 36.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 469.551 98zm-154 0h61.102A84.4 84.4 0 0 0 292 121.551a84 84 0 0 0-7 12.825c-6.5-14.865-17.179-27.485-30.551-36.376M131 134.376a84 84 0 0 1 7-12.825A84.4 84.4 0 0 1 161.551 98h-61.102c13.372 8.891 24.051 21.511 30.551 36.376"
          clip-rule="evenodd"
        />
      </svg>

      <Logo
        variant="full"
        style={{
          width: logoSize,
          height: logoSize / logoAspectRatio,
          marginTop: -28,
          position: "relative",
        }}
      />
    </div>
  );
}

export async function getOpengraphFonts() {
  const getFontFile = async (path: string) => {
    const data = await readFile(join(process.cwd(), `public/static/font/${path}`));
    const buffer = Uint8Array.from(data).buffer;
    return buffer;
  };

  const fontBold = getFontFile(`DMSansBold.ttf`);
  const fontSemiBold = getFontFile(`DMSansSemiBold.ttf`);
  const fontMedium = getFontFile(`DMSansMedium.ttf`);

  const [fontBoldData, fontSemiBoldData, fontMediumData] = await Promise.all([
    fontBold,
    fontSemiBold,
    fontMedium,
  ]);
  return [
    {
      name: "dm",
      weight: 700,
      style: "normal",
      data: fontBoldData,
    },
    {
      name: "dm",
      weight: 600,
      style: "normal",
      data: fontSemiBoldData,
    },
    {
      name: "dm",
      weight: 500,
      style: "normal",
      data: fontMediumData,
    },
  ] as const;
}

export async function DefaultOpenGraphResponse() {
  return new ImageResponse(<DefaultOpenGraphImage />, {
    ...opengraphSize,
    // @ts-expect-error - This is fine, they don't export the type so I can't set it
    fonts: await getOpengraphFonts(),
  });
}
