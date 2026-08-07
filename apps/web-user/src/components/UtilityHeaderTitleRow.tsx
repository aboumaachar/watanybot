import InlineInfoButton from "./InlineInfoButton";

type UtilityHeaderTitleRowProps = Readonly<{
  title: string;
  infoText?: string;
  infoLabel?: string;
  className?: string;
  titleClassName?: string;
  titleAs?: "h1" | "h2";
  infoClassName?: string;
}>;

export default function UtilityHeaderTitleRow({
  title,
  infoText,
  infoLabel,
  className = "",
  titleClassName = "",
  titleAs = "h2",
  infoClassName = "",
}: UtilityHeaderTitleRowProps) {
  const TitleTag = titleAs;

  return (
    <div className={`utility-header__title-row ${className}`.trim()}>
      <TitleTag className={titleClassName || undefined}>{title}</TitleTag>
      {infoText ? <InlineInfoButton text={infoText} label={infoLabel} className={infoClassName} /> : null}
    </div>
  );
}