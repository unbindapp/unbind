import { cn } from "@/components/ui/utils";
import { BanIcon } from "lucide-react";
import { ComponentProps } from "react";

type TProps = ComponentProps<"svg"> & {
  variant: string | unknown;
  className?: string;
  color?: "monochrome" | "brand";
};

const defaultClass = "size-5 shrink-0";

export default function ServiceIcon({ color = "monochrome", variant, className }: TProps) {
  if (variant === "go") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-go", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
  if (variant === "meilisearch") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-meilisearch", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
        className={cn(defaultClass, color === "brand" && "text-minio", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
        className={cn(defaultClass, color === "brand" && "text-mysql", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
  if (variant === "nextjs" || variant === "next") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-nextjs", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M11.345 2.005c-.043.004-.18.018-.303.028-2.84.256-5.501 1.788-7.187 4.144a9.9 9.9 0 0 0-1.765 4.37c-.08.55-.09.712-.09 1.456 0 .745.01.908.09 1.457.543 3.755 3.216 6.911 6.84 8.08.65.21 1.334.352 2.112.438.303.033 1.613.033 1.916 0 1.343-.149 2.48-.48 3.603-1.054.172-.088.205-.111.182-.13-.016-.012-.749-.996-1.629-2.184l-1.599-2.16-2.004-2.967a283 283 0 0 0-2.017-2.963c-.008-.002-.016 1.315-.02 2.924-.006 2.818-.008 2.93-.043 2.997a.36.36 0 0 1-.172.178c-.062.032-.117.037-.412.037h-.339l-.09-.056a.37.37 0 0 1-.13-.143l-.042-.088.004-3.92.006-3.922.06-.076a.5.5 0 0 1 .145-.12c.08-.038.112-.042.45-.042.399 0 .465.015.569.129.03.031 1.114 1.666 2.412 3.634l3.946 5.977 1.583 2.399.08-.053c.71-.462 1.46-1.118 2.055-1.803a9.96 9.96 0 0 0 2.354-5.112c.08-.55.09-.712.09-1.457 0-.744-.01-.907-.09-1.456-.543-3.756-3.216-6.911-6.84-8.08-.64-.208-1.32-.35-2.083-.436a26 26 0 0 0-1.642-.026m4.094 6.05c.094.046.17.136.197.23.016.05.02 1.138.016 3.587l-.006 3.516-.62-.95-.621-.95v-2.556c0-1.652.008-2.58.02-2.626a.4.4 0 0 1 .193-.246c.08-.04.11-.045.416-.045.29 0 .34.004.405.04"
        />
      </svg>
    );
  }
  if (variant === "postgresql") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-postgresql", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
        className={cn(defaultClass, color === "brand" && "text-redis", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
        className={cn(defaultClass, color === "brand" && "text-rust", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="m21.862 11.753-.84-.52-.023-.245.722-.672a.29.29 0 0 0-.097-.482l-.922-.345a8 8 0 0 0-.072-.238l.575-.8a.29.29 0 0 0-.188-.453l-.972-.159-.117-.217.409-.897a.28.28 0 0 0-.024-.28.29.29 0 0 0-.25-.129l-.987.035a6 6 0 0 0-.157-.19l.228-.96a.288.288 0 0 0-.348-.348l-.96.227-.19-.157.034-.986a.287.287 0 0 0-.409-.274l-.896.409-.219-.117-.158-.973a.29.29 0 0 0-.454-.188l-.8.575a8 8 0 0 0-.238-.072l-.345-.922a.29.29 0 0 0-.481-.096L13.01 3a8 8 0 0 0-.245-.023l-.519-.84a.288.288 0 0 0-.492 0l-.519.84L10.99 3l-.673-.722a.29.29 0 0 0-.482.096l-.345.922-.237.072-.8-.575A.29.29 0 0 0 8 2.982l-.159.973a8 8 0 0 0-.218.117l-.897-.409a.288.288 0 0 0-.408.274l.034.986q-.096.076-.19.156l-.96-.226a.29.29 0 0 0-.348.347l.226.961-.155.19-.987-.035a.288.288 0 0 0-.273.408l.408.898q-.06.108-.116.218l-.972.158a.29.29 0 0 0-.188.454l.575.798-.073.239-.921.345a.29.29 0 0 0-.097.482l.721.672q-.013.123-.023.245l-.84.52a.287.287 0 0 0 0 .492l.84.519.023.245-.721.673a.288.288 0 0 0 .097.482l.921.345q.035.12.073.238l-.575.8a.288.288 0 0 0 .189.453l.971.158.117.219-.408.896a.288.288 0 0 0 .273.409l.986-.034q.077.096.156.189l-.225.962a.29.29 0 0 0 .346.348l.961-.227a7 7 0 0 0 .19.156l-.034.987a.287.287 0 0 0 .408.272l.897-.408q.108.061.218.116l.159.973a.29.29 0 0 0 .454.19l.799-.576q.118.038.237.072l.345.923a.288.288 0 0 0 .482.096L10.99 21l.245.024.52.84a.29.29 0 0 0 .491 0l.52-.84.244-.025.673.722a.29.29 0 0 0 .481-.096l.345-.923q.12-.034.238-.073l.799.575a.287.287 0 0 0 .454-.188l.158-.972.219-.117.896.409a.29.29 0 0 0 .409-.273l-.035-.987q.097-.077.19-.156l.96.226a.288.288 0 0 0 .348-.346l-.227-.963q.08-.093.156-.19l.987.035a.287.287 0 0 0 .273-.409l-.408-.896q.06-.109.117-.219l.972-.158a.29.29 0 0 0 .188-.454l-.575-.799.073-.238.921-.345a.29.29 0 0 0 .097-.482l-.722-.673q.015-.123.023-.245l.84-.52a.287.287 0 0 0 .001-.491m-5.618 6.964a.595.595 0 1 1 .465-1.073.596.596 0 0 1-.465 1.073m-.285-1.929a.54.54 0 0 0-.642.417l-.299 1.391a7.25 7.25 0 0 1-3.015.65 7.25 7.25 0 0 1-3.08-.679l-.297-1.39a.54.54 0 0 0-.644-.417l-1.227.264a7.5 7.5 0 0 1-.634-.748h5.972c.067 0 .113-.012.113-.074v-2.114c0-.061-.045-.073-.113-.073h-1.747v-1.34h1.89c.172 0 .922.049 1.16 1.007.076.295.24 1.254.354 1.562.112.344.57 1.032 1.057 1.032h2.976a1 1 0 0 0 .109-.011q-.311.42-.678.793zm-8.26 1.9a.595.595 0 1 1-.266-1.159.595.595 0 0 1 .265 1.16m-2.267-9.19a.595.595 0 1 1-1.086.483.595.595 0 0 1 1.086-.484m-.695 1.65 1.279-.568a.54.54 0 0 0 .275-.715l-.264-.596h1.037v4.67h-2.09a7.3 7.3 0 0 1-.237-2.791m5.612-.452V9.32h2.466c.128 0 .9.147.9.725 0 .478-.593.65-1.08.65zm8.964 1.239q0 .273-.02.542h-.75c-.075 0-.106.05-.106.123v.345c0 .81-.457.987-.859 1.032-.38.043-.803-.16-.855-.394-.225-1.265-.6-1.536-1.192-2.003.735-.466 1.5-1.155 1.5-2.077 0-.994-.684-1.621-1.148-1.93-.653-.43-1.375-.516-1.57-.516H6.558a7.3 7.3 0 0 1 4.09-2.31l.914.96a.54.54 0 0 0 .765.018l1.023-.978a7.32 7.32 0 0 1 5.003 3.564l-.7 1.582a.543.543 0 0 0 .275.716l1.348.599q.035.358.035.726zm-7.75-8.003a.594.594 0 1 1 .82.86.595.595 0 0 1-.82-.86m6.949 5.594a.59.59 0 0 1 .782-.301.595.595 0 1 1-.783.303z"
        />
      </svg>
    );
  }
  if (variant === "svelte") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-svelte", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
        className={cn(defaultClass, color === "brand" && "text-umami", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
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
        className={cn(defaultClass, color === "brand" && "text-clickhouse", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M3.014 3.233a.21.21 0 0 1 .21-.21h1.578a.21.21 0 0 1 .21.21v17.583a.21.21 0 0 1-.21.21H3.223a.21.21 0 0 1-.21-.21zm4 17.583c0 .117.095.21.21.21h1.579a.21.21 0 0 0 .21-.21V3.233a.21.21 0 0 0-.21-.21H7.224a.21.21 0 0 0-.21.21zm4.002 0c0 .117.094.21.21.21h1.578c.117 0 .21-.095.21-.21V3.233a.21.21 0 0 0-.21-.21h-1.579a.21.21 0 0 0-.21.21zm4 0c0 .117.095.21.21.21h1.579a.21.21 0 0 0 .21-.21V3.233a.21.21 0 0 0-.21-.21h-1.579a.21.21 0 0 0-.21.21zm4.001-7.001c0 .117.095.21.21.21h1.58a.21.21 0 0 0 .21-.21v-3.58a.21.21 0 0 0-.21-.21h-1.58a.21.21 0 0 0-.21.21z"
        />
      </svg>
    );
  }
  if (variant === "astro") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-astro", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M8.982 18.827c-.988-.891-1.276-2.763-.864-4.12.713.855 1.701 1.127 2.725 1.28 1.58.235 3.133.147 4.6-.566.169-.081.324-.19.507-.3.138.395.174.792.126 1.198-.117.988-.615 1.75-1.406 2.328-.317.231-.652.438-.98.656-1.003.67-1.275 1.456-.897 2.6l.036.123a2.63 2.63 0 0 1-1.172-.99 2.75 2.75 0 0 1-.453-1.513c-.003-.267-.003-.535-.04-.798-.088-.641-.393-.928-.967-.944-.59-.017-1.056.342-1.179.908q-.015.064-.037.137zm-4.966-3.704s2.7-1.312 5.407-1.312l2.042-6.305c.076-.305.3-.511.551-.511s.475.206.552.511l2.04 6.305c3.208 0 5.408 1.312 5.408 1.312L15.422 2.631c-.132-.368-.354-.605-.654-.605H9.265c-.3 0-.513.237-.653.605z"
        />
      </svg>
    );
  }
  if (variant === "github") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-github", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
        />
      </svg>
    );
  }
  if (variant === "docker") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-docker", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M22.791 9.075c-.066-.044-.616-.473-1.804-.473-.308 0-.616.033-.924.088-.231-1.54-1.518-2.321-1.573-2.354l-.319-.187-.198.297a3.6 3.6 0 0 0-.561 1.309c-.22.88-.088 1.716.363 2.431-.539.308-1.419.385-1.606.385H1.682a.69.69 0 0 0-.682.693c0 1.265.198 2.53.638 3.718.495 1.309 1.243 2.277 2.2 2.871 1.078.66 2.849 1.034 4.862 1.034a14.7 14.7 0 0 0 2.662-.242c1.232-.22 2.42-.649 3.509-1.276a9.1 9.1 0 0 0 2.387-1.969c1.155-1.287 1.837-2.75 2.332-4.015h.209c1.254 0 2.035-.506 2.464-.935.286-.264.495-.583.649-.957L23 9.229zM3.035 10.164h1.936a.18.18 0 0 0 .176-.176V8.25a.18.18 0 0 0-.176-.176H3.035a.174.174 0 0 0-.176.176v1.738c.011.099.077.176.176.176m2.673 0h1.936a.18.18 0 0 0 .176-.176V8.25a.18.18 0 0 0-.176-.176H5.708a.174.174 0 0 0-.176.176v1.738c.011.099.077.176.176.176m2.717 0h1.925c.11 0 .187-.077.187-.176V8.25c0-.088-.066-.176-.187-.176H8.425c-.088 0-.165.077-.165.176v1.738c0 .099.066.176.165.176m2.684 0h1.947c.088 0 .165-.077.165-.176V8.25c0-.088-.066-.176-.165-.176h-1.947c-.088 0-.165.077-.165.176v1.738c0 .099.077.176.165.176M5.708 7.7h1.936c.088 0 .176-.099.176-.198V5.775a.174.174 0 0 0-.176-.176H5.708c-.099 0-.176.066-.176.176v1.727c.011.099.077.198.176.198m2.717 0h1.925c.11 0 .187-.099.187-.198V5.775c0-.099-.066-.176-.187-.176H8.425c-.088 0-.165.066-.165.176v1.727c0 .099.066.198.165.198m2.684 0h1.947c.088 0 .165-.099.165-.198V5.775c0-.099-.077-.176-.165-.176h-1.947c-.088 0-.165.066-.165.176v1.727c0 .099.077.198.165.198m0-2.508h1.947c.088 0 .165-.077.165-.176V3.3c0-.11-.077-.187-.165-.187h-1.947c-.088 0-.165.066-.165.187v1.716c0 .088.077.176.165.176m2.706 4.972h1.936a.174.174 0 0 0 .176-.176V8.25a.18.18 0 0 0-.176-.176h-1.936c-.088 0-.165.077-.165.176v1.738c0 .099.077.176.165.176"
        />
      </svg>
    );
  }
  if (variant === "strapi") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-strapi", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M7.89 10.055h5.82c.13 0 .235.106.235.236v5.82h-5.82a.235.235 0 0 1-.236-.236z"
          opacity=".5"
        />
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M19.765 4H7.889v6.055h5.82c.13 0 .234.104.236.233v-.233 6.056H20V4.235A.235.235 0 0 0 19.765 4"
        />
        <path
          fill="currentColor"
          d="M13.945 16.11H20l-5.855 5.855a.118.118 0 0 1-.2-.083zM7.89 10.055H2.117a.118.118 0 0 1-.083-.2L7.889 4z"
          opacity=".5"
        />
      </svg>
    );
  }
  if (variant === "mongodb") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-mongodb", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          d="M13.86 3.387a38 38 0 0 1-1.83-2.374.04.04 0 0 0-.059 0 38 38 0 0 1-1.831 2.374c-7.715 9.84 1.215 16.48 1.215 16.48l.075.05c.067 1.025.233 2.5.233 2.5h.666s.166-1.467.233-2.5l.075-.058c.008.008 8.938-6.632 1.223-16.472m-1.864 16.33s-.4-.341-.508-.516v-.017l.483-10.715c0-.033.05-.033.05 0l.483 10.715v.017c-.109.175-.508.516-.508.516"
        />
      </svg>
    );
  }
  if (variant === "pocketbase") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-pocketbase", className)}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.15792 2C2.51844 2 2.00003 2.51841 2.00003 3.1579V14.5263C2.00003 15.1658 2.51846 15.6842 3.15792 15.6842H8.31581V20.8421C8.31581 21.4816 8.83426 22 9.4737 22H20.8421C21.4816 22 22 21.4816 22 20.8421V9.47368C22 8.83425 21.4817 8.31579 20.8421 8.31579H15.6842V3.1579C15.6842 2.51843 15.1659 2 14.5263 2H3.15792ZM15.1586 9.36842L15.1579 9.36842L15.1579 9.36842C14.9762 9.36842 14.8161 9.27637 14.7215 9.13637C14.6647 9.05237 14.6316 8.95111 14.6316 8.84211L14.6316 8.83907V3.1579C14.6316 3.09975 14.5845 3.05263 14.5263 3.05263H3.15792C3.09979 3.05263 3.05266 3.09976 3.05266 3.1579V14.5263C3.05266 14.5845 3.09977 14.6316 3.15792 14.6316H8.84111L8.84212 14.6316L8.84213 14.6316C8.98747 14.6316 9.11905 14.6905 9.21429 14.7857C9.30954 14.881 9.36845 15.0126 9.36845 15.1579L9.36844 15.1611V20.8421C9.36844 20.9002 9.41556 20.9474 9.4737 20.9474H20.8421C20.9003 20.9474 20.9474 20.9003 20.9474 20.8421V9.47368C20.9474 9.41554 20.9003 9.36842 20.8421 9.36842H15.1586ZM6.73687 12C6.44619 12 6.21055 11.7644 6.21055 11.4737V5.68421C6.21055 5.39354 6.44619 5.1579 6.73687 5.1579H8.71218C9.09481 5.1579 9.45218 5.19638 9.78429 5.27333C10.1236 5.34329 10.416 5.46572 10.6615 5.64062C10.9142 5.80853 11.1127 6.0359 11.2571 6.32273C11.4015 6.60258 11.4737 6.9489 11.4737 7.36163C11.4737 7.76042 11.3979 8.10674 11.2463 8.40053C11.1019 8.69437 10.9033 8.93574 10.6507 9.12463C10.398 9.31353 10.1056 9.45348 9.77345 9.54442C9.44134 9.63537 9.0876 9.68084 8.71218 9.68084H8.32881C8.03813 9.68084 7.8025 9.91647 7.8025 10.2072V11.4737C7.8025 11.7644 7.56687 12 7.27618 12H6.73687ZM7.8025 7.92669C7.8025 8.21737 8.03813 8.453 8.32881 8.453H8.61471C9.48108 8.453 9.91424 8.08921 9.91424 7.36163C9.91424 7.00485 9.80234 6.753 9.57855 6.60607C9.36197 6.45916 9.04066 6.3857 8.61471 6.3857H8.32881C8.03813 6.3857 7.8025 6.62134 7.8025 6.912V7.92669ZM12.5263 18.3158C12.5263 18.6065 12.762 18.8421 13.0526 18.8421H15.0932C15.4743 18.8421 15.8266 18.8036 16.1501 18.7267C16.4809 18.6427 16.7685 18.5203 17.013 18.3594C17.2574 18.1915 17.448 17.9816 17.5846 17.7297C17.7212 17.4779 17.7895 17.1771 17.7895 16.8273C17.7895 16.3655 17.6601 16.0052 17.4012 15.7464C17.146 15.4912 16.7721 15.3176 16.2793 15.2256C16.267 15.2233 16.258 15.2126 16.258 15.2001C16.258 15.1882 16.2662 15.1778 16.2779 15.1749C16.478 15.1258 16.6511 15.0504 16.7973 14.9488C16.9482 14.8439 17.0741 14.7249 17.1747 14.592C17.2754 14.4591 17.3473 14.3157 17.3904 14.1618C17.4407 14.0078 17.4659 13.8539 17.4659 13.7001C17.4659 13.3712 17.3976 13.0984 17.261 12.8815C17.1316 12.6646 16.9519 12.4897 16.7217 12.3568C16.4917 12.2239 16.2184 12.1329 15.9021 12.0839C15.5929 12.028 15.255 12 14.8883 12H13.0526C12.762 12 12.5263 12.2356 12.5263 12.5263V18.3158ZM14.6381 14.7494C14.3474 14.7494 14.1118 14.5138 14.1118 14.2231V13.7331C14.1118 13.4425 14.3474 13.2068 14.6381 13.2068H14.8236C15.1974 13.2068 15.4707 13.2628 15.6432 13.3747C15.823 13.4796 15.9129 13.6581 15.9129 13.9099C15.9129 14.1757 15.8266 14.3822 15.654 14.5291C15.4815 14.676 15.2011 14.7494 14.8128 14.7494H14.6381ZM14.6381 17.6353C14.3474 17.6353 14.1118 17.3996 14.1118 17.109V16.3881C14.1118 16.0974 14.3474 15.8618 14.6381 15.8618H14.9637C15.4024 15.8618 15.7223 15.9283 15.9236 16.0612C16.1322 16.1941 16.2364 16.411 16.2364 16.7118C16.2364 17.3275 15.8122 17.6353 14.9637 17.6353H14.6381Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (variant === "ghost") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-ghost", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M10.434 2.072c-2.517.427-4.942 1.876-6.604 3.823-2.51 2.943-2.428 8.502.184 12.426 1.001 1.504 2.307 1.721 3.667 2.645 2.556 1.734 6.288 1.343 8.595-.901.524-.509.555-.53 1.037-.696 1.766-.607 3.411-2.367 4.222-4.517.625-1.66.62-3.13-.017-5.035a9 9 0 0 1-.215-.716c-.741-3.66-6.974-7.69-10.87-7.03M18.16 5.54c3.156 3.582 3.032 6.77.476 10.428-1.492 2.134-1.611 2.23-3.627 2.918-1.466.5-2.08-.268-3.463-.59-3.22-.749-5.668-3.19-6.654-6.305-.929-2.936-.37-6.692 2.757-7.776 3.11-1.08 8.03-1.488 10.51 1.325"
        />
      </svg>
    );
  }
  if (variant === "n8n") {
    return (
      <svg
        className={cn(defaultClass, color === "brand" && "text-n8n", className)}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M22 8.923a2.051 2.051 0 0 1-4.038.513h-2.864c-.501 0-.93.362-1.012.857l-.084.506A2.05 2.05 0 0 1 13.336 12c.343.303.586.72.666 1.201l.084.506c.083.495.51.857 1.012.857h.813a2.052 2.052 0 1 1 0 1.026h-.813a2.05 2.05 0 0 1-2.023-1.714l-.084-.506a1.026 1.026 0 0 0-1.012-.857h-.837a2.052 2.052 0 0 1-3.925 0H6.014a2.052 2.052 0 1 1 .044-1.026h1.115a2.052 2.052 0 0 1 4.013 0h.793c.501 0 .93-.362 1.012-.857l.084-.506a2.05 2.05 0 0 1 2.023-1.714h2.864A2.052 2.052 0 0 1 22 8.923m-1.026 0a1.026 1.026 0 1 1-2.05 0 1.026 1.026 0 0 1 2.05 0M4.051 12.94a1.026 1.026 0 1 0 0-2.051 1.026 1.026 0 0 0 0 2.051m5.128 0a1.026 1.026 0 1 0 0-2.051 1.026 1.026 0 0 0 0 2.051m8.719 3.163a1.026 1.026 0 1 0 0-2.052 1.026 1.026 0 0 0 0 2.052"
        />
      </svg>
    );
  }
  return (
    <BanIcon className={cn(defaultClass, color === "brand" && "text-foreground", className)} />
  );
}
