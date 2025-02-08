import { cn } from "@/components/ui/utils";
import { TServiceType } from "@/server/trpc/api/main/router";
import { BanIcon } from "lucide-react";
import { ComponentProps } from "react";

type Props = ComponentProps<"svg"> & {
  variant: TServiceType;
  className?: string;
};

const defaultClass = "size-5 shrink-0";

export default function ServiceIcon({ variant, className }: Props) {
  if (variant === "go") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M14.757 10.222c-.375.095-.685.177-1 .26-.25.067-.505.135-.8.21l-.017.006c-.144.038-.16.042-.293-.112-.16-.182-.279-.3-.504-.407-.674-.332-1.328-.236-1.938.16-.729.472-1.104 1.168-1.093 2.036.01.857.6 1.563 1.446 1.681.729.097 1.339-.16 1.821-.707.072-.087.137-.18.21-.284l.08-.112H10.6c-.225 0-.279-.14-.204-.321.14-.332.397-.89.547-1.168a.29.29 0 0 1 .267-.171h3.448a4.6 4.6 0 0 1 .74-1.393c.783-1.028 1.725-1.564 3-1.789 1.092-.192 2.12-.085 3.053.547.846.578 1.37 1.36 1.51 2.388.182 1.446-.236 2.625-1.232 3.632-.707.717-1.575 1.167-2.57 1.37-.19.036-.38.052-.568.069q-.146.012-.29.028c-.974-.021-1.863-.3-2.613-.943a3.37 3.37 0 0 1-1.071-1.668 4.5 4.5 0 0 1-.45.726c-.771 1.017-1.778 1.65-3.053 1.82-1.05.14-2.024-.064-2.881-.706-.793-.6-1.243-1.393-1.36-2.378-.14-1.168.203-2.217.91-3.139.76-.996 1.767-1.628 2.999-1.853 1.007-.182 1.97-.064 2.839.525.567.375.974.89 1.242 1.51.064.097.021.15-.107.183m-12.093.192c-.043 0-.054-.021-.032-.053l.225-.29c.02-.031.074-.053.117-.053h3.824c.043 0 .054.032.032.064l-.182.279c-.021.032-.075.064-.107.064zm-1.618.986c-.043 0-.053-.021-.032-.054l.225-.289c.021-.032.075-.053.118-.053H6.24c.043 0 .065.032.054.064l-.086.257c-.01.043-.053.064-.096.064zm2.56.921c-.021.032-.01.064.032.064l2.335.011c.033 0 .075-.032.075-.075l.022-.257c0-.043-.022-.075-.064-.075H3.863c-.043 0-.085.032-.107.064zm17.238-.618.008.115c-.054.92-.514 1.606-1.36 2.045-.568.29-1.158.322-1.747.065-.77-.343-1.178-1.19-.985-2.025.236-1.007.878-1.639 1.874-1.864 1.018-.235 1.993.365 2.186 1.425.015.076.02.152.024.239"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (variant === "meili") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
      >
        <path
          fill="currentColor"
          d="m7.423 17.857 3.694-9.454a3.475 3.475 0 0 1 3.235-2.21h2.229l-3.695 9.455a3.475 3.475 0 0 1-3.236 2.21zm5.42 0 3.695-9.454a3.475 3.475 0 0 1 3.236-2.21h2.228l-3.695 9.455a3.475 3.475 0 0 1-3.235 2.21zm-10.841 0 3.695-9.454a3.475 3.475 0 0 1 3.235-2.21h2.228l-3.695 9.455a3.475 3.475 0 0 1-3.236 2.21z"
        />
      </svg>
    );
  }
  if (variant === "minio") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
      >
        <path
          fill="currentColor"
          d="M13.013 2.03a1.8 1.8 0 0 0-1.35.486 1.79 1.79 0 0 0-.08 2.529l2.84 2.958a2.534 2.534 0 0 1-.552 3.907l-.386.2V8.096a12.85 12.85 0 0 0-6.682 8.739v.014l5.458-2.773v6.35l1.228 1.599v-8.599l.748-.385a3.703 3.703 0 0 0 1.017-5.859l-2.809-2.937a.625.625 0 0 1 .031-.88.625.625 0 0 1 .88.032l.39.405-.006.005 3.392 3.537a.05.05 0 0 0 .052.01l.016-.01a.05.05 0 0 0 0-.058L14.584 3l-.125.119.125-.12c-.499-.647-1.053-.93-1.571-.97m-.752 8.222v2.495l-3.46 1.79a11.7 11.7 0 0 1 3.46-4.285"
        />
      </svg>
    );
  }
  if (variant === "mysql") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M6.56 5.593a2.3 2.3 0 0 0-.558.061v.032h.03c.11.222.3.367.435.558l.31.651.032-.03c.191-.136.28-.352.279-.683-.078-.081-.09-.183-.156-.28-.088-.128-.26-.201-.372-.31m15.014 15.914c.146.107.245.274.435.341v-.031c-.1-.127-.125-.302-.217-.434l-.403-.404a6.7 6.7 0 0 0-1.428-1.365c-.423-.304-1.374-.716-1.55-1.209l-.032-.032c.3-.033.653-.142.93-.216.467-.125.884-.094 1.365-.217l.652-.187v-.125c-.243-.25-.417-.58-.682-.805-.695-.592-1.453-1.184-2.234-1.675-.433-.275-.968-.451-1.427-.684-.154-.077-.425-.118-.527-.247-.242-.309-.372-.698-.558-1.055a40 40 0 0 1-1.117-2.359c-.236-.537-.39-1.067-.683-1.55-1.409-2.316-2.925-3.714-5.274-5.088-.5-.292-1.101-.407-1.736-.558l-1.024-.062c-.209-.087-.425-.342-.62-.466-.779-.491-2.775-1.56-3.35-.155-.365.888.543 1.754.868 2.203.227.316.52.669.682 1.024.107.233.125.467.217.713.226.609.422 1.269.713 1.83.149.284.311.584.497.838.115.156.31.225.34.466-.19.267-.2.683-.308 1.023-.485 1.53-.303 3.43.403 4.56.216.347.725 1.092 1.426.807.613-.25.477-1.024.652-1.706.039-.155.015-.27.093-.373v.031l.558 1.117c.414.666 1.147 1.361 1.769 1.83.321.244.575.665.992.807v-.031h-.03c-.082-.125-.21-.178-.31-.28a7 7 0 0 1-.715-.806 19 19 0 0 1-1.52-2.481c-.217-.418-.406-.878-.59-1.303-.07-.165-.07-.412-.216-.497-.2.312-.496.563-.651.93-.249.588-.281 1.305-.373 2.048-.054.02-.03.006-.062.031-.432-.104-.584-.55-.745-.93-.405-.965-.481-2.52-.124-3.63.093-.287.511-1.192.342-1.458-.082-.265-.348-.418-.497-.62a5 5 0 0 1-.496-.87c-.332-.751-.488-1.596-.838-2.357-.167-.363-.45-.73-.682-1.054-.257-.358-.545-.622-.745-1.055-.07-.154-.167-.4-.062-.558.033-.107.08-.152.187-.186.18-.14.68.046.868.123.497.207.912.403 1.333.683.203.134.408.394.652.465h.28c.437.1.926.031 1.333.155.721.22 1.367.56 1.954.931a12.1 12.1 0 0 1 4.25 4.654c.161.308.231.603.373.93.286.66.646 1.34.93 1.985.283.645.56 1.295.962 1.83.21.282 1.025.434 1.396.59.26.11.684.225.93.372.47.283.925.62 1.365.93.22.157.898.497.931.776-1.092-.028-1.925.072-2.637.373-.202.085-.525.088-.558.341.11.117.128.292.217.434.17.275.457.644.713.838.28.211.57.437.87.62.533.326 1.13.512 1.643.838.304.193.605.434.9.652"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (variant === "nextjs") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
      >
        <path
          fill="currentColor"
          d="m11.345 2.026-.303.027c-2.84.256-5.501 1.789-7.187 4.145a9.9 9.9 0 0 0-1.765 4.37c-.08.549-.09.711-.09 1.456s.01.907.09 1.456c.543 3.756 3.216 6.912 6.84 8.08.65.21 1.334.353 2.112.439.303.033 1.613.033 1.916 0 1.343-.15 2.48-.481 3.603-1.054.172-.088.205-.112.182-.131-.016-.012-.749-.995-1.629-2.184l-1.599-2.16-2.004-2.966a283 283 0 0 0-2.017-2.964c-.008-.002-.016 1.316-.02 2.925-.006 2.817-.008 2.93-.043 2.997a.36.36 0 0 1-.172.178c-.062.031-.117.037-.412.037h-.339l-.09-.057a.37.37 0 0 1-.13-.143l-.042-.087.004-3.92.006-3.922.06-.076a.5.5 0 0 1 .145-.12c.08-.039.112-.043.45-.043.399 0 .465.016.569.13.03.03 1.114 1.665 2.412 3.634q1.972 2.989 3.946 5.976l1.583 2.4.08-.054c.71-.461 1.46-1.118 2.055-1.802a9.96 9.96 0 0 0 2.354-5.113c.08-.549.09-.711.09-1.456s-.01-.907-.09-1.457c-.543-3.755-3.216-6.91-6.84-8.08-.64-.207-1.32-.35-2.083-.436a26 26 0 0 0-1.642-.025m4.094 6.049c.094.047.17.137.197.23.016.051.02 1.138.016 3.588l-.006 3.515-.62-.95-.621-.95v-2.555c0-1.652.008-2.581.02-2.626a.4.4 0 0 1 .193-.246c.08-.041.11-.045.416-.045.29 0 .34.004.405.039"
        />
      </svg>
    );
  }
  if (variant === "postgres") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        fill="none"
        viewBox="0 0 25 25"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M20.442 13.396c1.132-.23 1.44.42 1.513.62.36 1-1.143 1.769-1.606 1.999a5.54 5.54 0 0 1-2.471.4h-.175v.26a7.16 7.16 0 0 1-.937 3.997c-.273.349-.614.64-1.005.859s-.823.357-1.27.41q-.357.081-.721.08a2.18 2.18 0 0 1-1.534-.56 3 3 0 0 1-.732-1.239 1 1 0 0 0 0-.13 8.2 8.2 0 0 1-.319-2.358v-.81a3.86 3.86 0 0 1-2.42.14 2.07 2.07 0 0 1-1.029-.59 1.8 1.8 0 0 1-.818.415c-.306.065-.624.05-.922-.045a3.44 3.44 0 0 1-1.802-1.829 15.5 15.5 0 0 1-1.143-2.758 25.6 25.6 0 0 1-1.03-4.667c-.102-2.129.485-3.648 1.761-4.517.643-.39 1.36-.65 2.108-.763a5.8 5.8 0 0 1 2.248.103q.928.154 1.822.44a5.06 5.06 0 0 1 2.533-.62q.752.014 1.493.14a9 9 0 0 1 2.533-.35 6.24 6.24 0 0 1 2.722.566c.85.39 1.596.966 2.179 1.683.792.99.494 2.928.113 4.377a19.4 19.4 0 0 1-2.121 4.877 6.7 6.7 0 0 0 1.03-.13m-2.204 2.429a5 5 0 0 0 1.853-.34v-.02c.525-.24 1.473-.82 1.246-1.369-.092-.25-.37-.35-.844-.25-1.39.31-1.894.11-2.06 0a18.6 18.6 0 0 0 2.482-5.407c.237-.889.71-3.008 0-3.887a5.5 5.5 0 0 0-1.982-1.506 5.65 5.65 0 0 0-2.466-.493 8 8 0 0 0-2.574.4 6 6 0 0 0-1.441-.18 4.2 4.2 0 0 0-2.482.66c-.72-.25-3.892-1.3-5.868.06C3 4.213 2.485 5.57 2.588 7.49c.2 1.537.544 3.052 1.03 4.527.782 2.549 1.637 3.998 2.543 4.338q.18.024.36 0c.228-.012.45-.075.648-.185.198-.109.368-.261.495-.445.662-.765 1.278-1.415 1.543-1.694l.043-.045c.352.183.743.285 1.143.3a3 3 0 0 0-.196.24c-.278.34-.34.41-1.225.59l-.058.01c-.28.054-.86.164-.869.629-.01.5.793.73.885.73q.476.12.968.13a2.68 2.68 0 0 0 1.833-.66 16.3 16.3 0 0 0 .288 4.057c.112.422.363.796.714 1.067s.784.422 1.232.432q.344 0 .68-.07a2.58 2.58 0 0 0 1.597-.732c.424-.422.68-.978.72-1.566.133-.73.36-2.479.463-3.418.264.073.538.107.813.1m-1.07-10.923a6 6 0 0 1 1.41 2.568q.008.075 0 .15.005.534-.093 1.06a7 7 0 0 0-.092.859q-.004.502.072 1a3.9 3.9 0 0 1-.371 2.708l.072.08c2.286-3.488 3.089-7.536 2.358-8.425a4.9 4.9 0 0 0-1.746-1.343 5 5 0 0 0-2.177-.456 7.8 7.8 0 0 0-1.678.16 6.3 6.3 0 0 1 2.244 1.639M7.838 8.719q.078 1.152-.062 2.299c-.073.444-.038.898.1 1.326.14.429.38.82.703 1.142l.196.19c-.278.29-.885.94-1.544 1.7-.404.47-.698.431-.835.414l-.05-.005c-.68-.23-1.473-1.629-2.173-3.848a24 24 0 0 1-1.03-4.397c-.093-1.709.34-2.908 1.266-3.548 1.514-1.1 3.985-.42 5.015-.1A6.87 6.87 0 0 0 7.839 8.44zm3.525 5.69.017.007a.6.6 0 0 1 .257.37.4.4 0 0 1 0 .35 2.27 2.27 0 0 1-1.151.81c-.463.144-.962.14-1.423-.011a1.1 1.1 0 0 1-.38-.16 2 2 0 0 1 .411-.11c1.04-.21 1.194-.36 1.555-.79q.132-.188.298-.35c.18-.202.262-.172.416-.115m6.575-6.6a5 5 0 0 1-.082.79 6 6 0 0 0-.144.93q-.002.526.072 1.05c.16.71.103 1.45-.165 2.128a2 2 0 0 1-.154-.31 4 4 0 0 0-.268-.48l-.119-.226c-.508-.958-1.46-2.757-.91-3.521.308-.43 1.09-.44 1.77-.36m-.988.8a.62.62 0 0 0 .33-.17.38.38 0 0 0 .123-.26c-.02-.15-.268-.19-.515-.15s-.453.14-.453.28a.47.47 0 0 0 .179.219c.08.053.176.082.274.081zm-6.229 4.188v.11a8 8 0 0 0-.309.81 2.1 2.1 0 0 1-.802-.17 2.1 2.1 0 0 1-.67-.46 2.35 2.35 0 0 1-.56-.928 2.3 2.3 0 0 1-.079-1.071c.11-.799.13-1.606.062-2.409V8.5a3.28 3.28 0 0 1 2.142-.61.9.9 0 0 1 .46.266.85.85 0 0 1 .22.474 5 5 0 0 1-.268 3.738c-.072.14-.134.28-.196.43m-.855-4.428a.35.35 0 0 0 .093.23.65.65 0 0 0 .422.25h.062a.54.54 0 0 0 .306-.087c.09-.059.16-.144.198-.243.021-.18-.236-.34-.494-.34a.8.8 0 0 0-.494.07.2.2 0 0 0-.093.12m7.743 5.237a4 4 0 0 1-.638-.999c0-.05-.065-.154-.145-.28q-.045-.071-.092-.15c-.597-1-1.843-3.218-1.03-4.337a2.24 2.24 0 0 1 1.005-.596c.385-.107.791-.112 1.178-.014a6.2 6.2 0 0 0-1.163-1.939 5.55 5.55 0 0 0-1.897-1.458 5.7 5.7 0 0 0-2.356-.54c-.481-.03-.964.04-1.417.203a3.5 3.5 0 0 0-1.208.746A5.72 5.72 0 0 0 8.426 7.82l.154-.08a3.9 3.9 0 0 1 1.38-.42 1.54 1.54 0 0 1 1.173.211c.17.112.315.257.425.425s.183.357.214.553a5.57 5.57 0 0 1-.298 4.088 3 3 0 0 0-.175.39v.11c-.103.27-.196.52-.258.73a1 1 0 0 1 .587.07c.155.07.292.174.402.301.11.128.191.277.236.438v.16q.008.045 0 .09a21.6 21.6 0 0 0 .227 4.897c.046.211.14.41.272.584.134.173.304.316.5.42a1.58 1.58 0 0 0 1.287.085c.49-.032.95-.24 1.292-.584a1.9 1.9 0 0 0 .551-1.275c.155-.88.463-3.348.505-3.878 0-1.059.535-1.269.865-1.359zm.505.68.082.06c.8.309 1.689.327 2.502.05-.241.214-.516.39-.814.52a4.5 4.5 0 0 1-1.42.29 2 2 0 0 1-.958-.12c-.03-.66.216-.73.484-.8z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (variant === "redis") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        fill="none"
        viewBox="0 0 25 25"
      >
        <path
          fill="currentColor"
          d="M22.01 13.974c-.007.192-.262.404-.779.674-1.068.557-6.595 2.832-7.774 3.443-1.178.615-1.83.61-2.76.163-.932-.443-6.813-2.823-7.875-3.327-.527-.254-.797-.466-.807-.667v2.02c0 .203.28.414.807.668 1.062.508 6.947 2.885 7.875 3.327.93.446 1.582.453 2.76-.162 1.178-.612 6.706-2.888 7.774-3.444.544-.28.784-.501.784-.7v-1.993q0-.004-.006-.003m0-3.294c-.01.188-.262.4-.779.673-1.068.553-6.595 2.83-7.774 3.44-1.178.616-1.83.61-2.76.167-.932-.446-6.813-2.822-7.875-3.33-.527-.25-.797-.465-.807-.667v2.02c0 .203.28.418.807.668 1.062.509 6.943 2.885 7.875 3.33.93.443 1.582.45 2.76-.162 1.178-.615 6.706-2.888 7.774-3.444.544-.283.784-.504.784-.703V10.68zm0-3.422c.01-.202-.255-.38-.792-.576-1.038-.38-6.536-2.568-7.588-2.956-1.052-.384-1.482-.368-2.718.075-1.237.447-7.087 2.741-8.128 3.148-.521.205-.775.394-.765.596v2.02c0 .203.276.414.807.668 1.058.508 6.943 2.885 7.874 3.33.928.443 1.582.45 2.761-.166 1.175-.612 6.706-2.887 7.774-3.44.54-.284.781-.505.781-.704V7.258zM9.176 9.173l4.635-.71-1.4 2.05zm10.25-1.85L16.39 8.525 13.65 7.44l3.033-1.198zM11.38 5.338l-.449-.827 1.4.547 1.318-.43-.358.853 1.344.504-1.732.179-.39.934-.625-1.042-2.002-.178zM7.927 6.506c1.37 0 2.477.43 2.477.957 0 .53-1.11.96-2.477.96-1.368 0-2.478-.43-2.478-.96 0-.527 1.11-.957 2.478-.957"
        />
      </svg>
    );
  }
  if (variant === "rust") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
      >
        <path
          fill="currentColor"
          d="m21.868 11.76-.84-.52-.024-.245.722-.672a.29.29 0 0 0-.097-.482l-.922-.345a7 7 0 0 0-.072-.237l.575-.8a.29.29 0 0 0-.188-.454l-.972-.158a7 7 0 0 0-.117-.218l.409-.896a.28.28 0 0 0-.024-.28.29.29 0 0 0-.25-.129l-.987.035a6 6 0 0 0-.157-.19l.228-.96a.29.29 0 0 0-.348-.348l-.96.228-.19-.157.034-.987a.286.286 0 0 0-.409-.273l-.896.408-.219-.116-.158-.973a.29.29 0 0 0-.454-.188l-.8.575a8 8 0 0 0-.238-.072l-.345-.922a.29.29 0 0 0-.482-.096l-.672.722a8 8 0 0 0-.245-.023l-.52-.84a.288.288 0 0 0-.49 0l-.52.84-.245.023-.673-.722a.288.288 0 0 0-.482.096l-.345.922-.237.072-.8-.575a.29.29 0 0 0-.454.188l-.158.973a8 8 0 0 0-.218.116l-.897-.408a.288.288 0 0 0-.408.273l.034.987a7 7 0 0 0-.19.156l-.961-.227a.29.29 0 0 0-.348.348l.226.96-.155.19-.986-.035a.288.288 0 0 0-.274.408l.409.897a8 8 0 0 0-.117.219l-.972.158a.29.29 0 0 0-.188.453l.575.799-.073.238-.921.345a.29.29 0 0 0-.097.482l.722.672q-.014.123-.024.245l-.84.52a.287.287 0 0 0 0 .491l.84.52q.01.122.024.244l-.722.673a.288.288 0 0 0 .097.481l.921.346q.036.12.073.238l-.575.799a.288.288 0 0 0 .189.453l.972.159.116.218-.408.897a.288.288 0 0 0 .273.408l.986-.034.156.189-.225.962a.288.288 0 0 0 .347.347l.96-.227q.095.081.19.156l-.034.987a.286.286 0 0 0 .409.273l.896-.409q.109.06.219.117l.158.972a.29.29 0 0 0 .454.19l.8-.576q.117.039.237.072l.345.923a.287.287 0 0 0 .482.095l.673-.72.245.025.519.838a.29.29 0 0 0 .492 0l.519-.84.245-.024.672.721a.29.29 0 0 0 .482-.095l.345-.923q.12-.035.237-.072l.8.575a.288.288 0 0 0 .454-.189l.158-.971.218-.117.897.408a.29.29 0 0 0 .409-.273l-.035-.987q.097-.075.19-.155l.96.226a.288.288 0 0 0 .348-.346l-.227-.963q.08-.093.156-.19l.987.035a.287.287 0 0 0 .273-.408l-.408-.897q.06-.108.117-.218l.972-.159a.29.29 0 0 0 .188-.453l-.575-.8.073-.237.921-.345a.29.29 0 0 0 .097-.482l-.722-.673q.014-.122.024-.245l.84-.52a.286.286 0 0 0 0-.49m-5.619 6.962a.595.595 0 0 1 .25-1.163.596.596 0 1 1-.25 1.163m-.285-1.928a.54.54 0 0 0-.642.416l-.299 1.391a7.25 7.25 0 0 1-3.015.65 7.25 7.25 0 0 1-3.08-.679l-.298-1.39a.54.54 0 0 0-.643-.417l-1.228.264a8 8 0 0 1-.634-.748h5.973c.067 0 .113-.011.113-.073v-2.113c0-.062-.045-.074-.114-.074h-1.746v-1.34h1.89c.172 0 .922.05 1.16 1.008.076.294.24 1.253.354 1.56.112.345.57 1.032 1.057 1.032h2.976a1 1 0 0 0 .109-.01q-.311.42-.678.793zm-8.261 1.9a.595.595 0 1 1-.266-1.16.595.595 0 0 1 .266 1.16m-2.267-9.19a.595.595 0 1 1-1.086.484.595.595 0 0 1 1.086-.484m-.694 1.651 1.278-.568a.54.54 0 0 0 .275-.715l-.263-.596h1.036v4.669h-2.09a7.3 7.3 0 0 1-.237-2.79m5.611-.452V9.327h2.467c.127 0 .9.147.9.725 0 .478-.593.65-1.08.65zm8.965 1.238q0 .275-.02.543h-.75c-.075 0-.106.049-.106.123v.344c0 .811-.457.987-.859 1.032-.38.043-.803-.16-.855-.394-.226-1.264-.6-1.535-1.192-2.002.735-.467 1.499-1.155 1.499-2.077 0-.994-.683-1.62-1.148-1.929-.652-.43-1.375-.517-1.569-.517H6.562a7.3 7.3 0 0 1 4.089-2.308l.915.96a.54.54 0 0 0 .765.017l1.022-.978a7.32 7.32 0 0 1 5.004 3.564l-.7 1.581a.543.543 0 0 0 .275.716l1.348.598q.035.36.035.727zm-7.75-8a.594.594 0 1 1 .82.86.595.595 0 0 1-.82-.86m6.949 5.593a.592.592 0 0 1 1.045-.077.595.595 0 1 1-1.046.078z"
        />
      </svg>
    );
  }
  if (variant === "svelte") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        fill="none"
        viewBox="0 0 25 25"
      >
        <path
          fill="currentColor"
          d="M10.642 19.63a3.7 3.7 0 0 1-3.971-1.472 3.42 3.42 0 0 1-.586-2.59 3 3 0 0 1 .112-.434l.087-.268.24.175a6 6 0 0 0 1.821.91l.173.053-.016.173c-.021.246.045.49.188.692a1.12 1.12 0 0 0 1.196.444 1 1 0 0 0 .286-.125l4.658-2.968a.97.97 0 0 0 .437-.649 1.03 1.03 0 0 0-.176-.78 1.12 1.12 0 0 0-1.196-.445 1 1 0 0 0-.286.125l-1.777 1.134c-.292.187-.611.327-.946.415a3.7 3.7 0 0 1-3.971-1.471 3.42 3.42 0 0 1-.585-2.59 3.22 3.22 0 0 1 1.452-2.152l4.657-2.97c.292-.186.611-.327.946-.415a3.7 3.7 0 0 1 3.971 1.472 3.42 3.42 0 0 1 .586 2.59 3 3 0 0 1-.112.435l-.087.267-.239-.175a6 6 0 0 0-1.822-.91l-.174-.053.017-.173a1.04 1.04 0 0 0-.188-.692 1.12 1.12 0 0 0-1.196-.444 1 1 0 0 0-.286.125L9.197 9.833a.97.97 0 0 0-.437.648 1.03 1.03 0 0 0 .176.781 1.12 1.12 0 0 0 1.196.444 1 1 0 0 0 .286-.126l1.777-1.133c.292-.187.611-.327.946-.415a3.7 3.7 0 0 1 3.97 1.472 3.42 3.42 0 0 1 .586 2.59 3.22 3.22 0 0 1-1.452 2.152l-4.657 2.969c-.292.187-.611.327-.946.416m8.632-14.958c-1.857-2.659-5.526-3.446-8.177-1.756L6.438 5.884a5.33 5.33 0 0 0-2.413 3.58 5.63 5.63 0 0 0 .555 3.613 5.3 5.3 0 0 0-.8 1.997 5.7 5.7 0 0 0 .973 4.306c1.858 2.658 5.525 3.446 8.177 1.757l4.659-2.969a5.33 5.33 0 0 0 2.413-3.58 5.63 5.63 0 0 0-.554-3.613c.399-.604.67-1.283.798-1.996a5.7 5.7 0 0 0-.972-4.307"
        />
      </svg>
    );
  }
  if (variant === "umami") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        fill="none"
        viewBox="0 0 25 25"
      >
        <path
          fill="currentColor"
          d="M3.85 9.203H2.728a.704.704 0 0 0-.701.701v.715q-.013.25-.013.5c0 5.523 4.477 10 10 10 5.439 0 9.864-4.343 9.996-9.75q.002-.033.004-.063V9.904a.704.704 0 0 0-.701-.7H20.19c-.966-3.608-4.26-6.268-8.17-6.268S4.815 5.596 3.85 9.203m15.37 0H4.822a7.53 7.53 0 0 1 7.198-5.332c3.391 0 6.26 2.247 7.2 5.332"
        />
      </svg>
    );
  }
  if (variant === "clickhouse") {
    return (
      <svg
        className={cn(defaultClass, className)}
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        fill="none"
        viewBox="0 0 25 25"
      >
        <path
          fill="currentColor"
          d="M3.014 3.233a.21.21 0 0 1 .21-.21h1.578a.21.21 0 0 1 .21.21v17.583a.21.21 0 0 1-.21.21H3.223a.21.21 0 0 1-.21-.21zm4 17.583c0 .117.095.21.21.21h1.579a.21.21 0 0 0 .21-.21V3.233a.21.21 0 0 0-.21-.21H7.224a.21.21 0 0 0-.21.21zm4.002 0c0 .117.094.21.21.21h1.578c.117 0 .21-.095.21-.21V3.233a.21.21 0 0 0-.21-.21h-1.579a.21.21 0 0 0-.21.21zm4 0c0 .117.095.21.21.21h1.579a.21.21 0 0 0 .21-.21V3.233a.21.21 0 0 0-.21-.21h-1.579a.21.21 0 0 0-.21.21zm4.001-7.001c0 .117.095.21.21.21h1.58a.21.21 0 0 0 .21-.21v-3.58a.21.21 0 0 0-.21-.21h-1.58a.21.21 0 0 0-.21.21z"
        />
      </svg>
    );
  }
  return <BanIcon className={cn(defaultClass, className)} />;
}
