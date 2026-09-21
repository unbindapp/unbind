import templates from "../../generated/templates.gen.json";

type Template = (typeof templates)[number];

function findTemplate(name: string): Template {
  const template = templates.find((candidate) => candidate.name === name);
  if (!template) throw new Error(`unknown template: ${name}`);
  return template;
}

function formatAmount(amount: number, unit: string) {
  return `${amount} ${unit}`;
}

export function TemplateServices({ name }: { name: string }) {
  const template = findTemplate(name);
  const { minimum_recommended_cpu: cpu, minimum_recommended_ram_gb: ram } =
    template.resource_recommendations;

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Runs</th>
          </tr>
        </thead>
        <tbody>
          {template.services.map((service) => (
            <tr key={service.name}>
              <td>{service.name}</td>
              <td>
                <code>{service.image ?? service.database_type}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Plan for at least <strong>{formatAmount(cpu, cpu === 1 ? "CPU core" : "CPU cores")}</strong>{" "}
        and <strong>{formatAmount(ram, "GB of memory")}</strong>.
      </p>
    </>
  );
}

export function TemplateInputs({ name }: { name: string }) {
  const template = findTemplate(name);

  return (
    <table>
      <thead>
        <tr>
          <th>Input</th>
          <th>Description</th>
          <th>Default</th>
        </tr>
      </thead>
      <tbody>
        {template.inputs.map((input) => (
          <tr key={input.name}>
            <td>
              {input.name}
              {input.required ? "" : " (optional)"}
            </td>
            <td>{input.description}</td>
            <td>{input.default ? <code>{input.default}</code> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
