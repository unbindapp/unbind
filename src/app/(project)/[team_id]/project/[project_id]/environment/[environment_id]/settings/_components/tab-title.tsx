type Props = {
  children: string;
};

export default function TabTitle({ children }: Props) {
  return <h2 className="w-full px-1 text-xl leading-tight font-bold">{children}</h2>;
}
