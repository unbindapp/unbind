type Props = {
  children: string;
};

export default function TabTitle({ children }: Props) {
  return (
    <h2 className="w-full font-bold text-xl leading-tight px-1">{children}</h2>
  );
}
