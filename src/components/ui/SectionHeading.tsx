interface SectionHeadingProps {
  title: string;
  subtitle: string;
}

export function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-extrabold text-text-body mb-4">{title}</h2>
      <p className="text-text-muted text-lg max-w-2xl mx-auto">{subtitle}</p>
    </div>
  );
}
