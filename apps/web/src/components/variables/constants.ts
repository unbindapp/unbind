// The "Provided Variables" section's open state lives in the URL. Only services have
// provided variables (see providedVariables in the API's variables service), so the
// section renders in the service panel, which is inside the project route's subtree.
export const providedVariablesKey = "provided_variables";
// The raw editor renders in team settings, project settings and the service panel,
// so its open state is validated on the root route, their only common ancestor.
export const rawVariableEditorKey = "raw_editor";
export const HIDDEN_VARIABLE_VALUE = "••••••••";
// DOM id of the variables section in the service panel, for links that jump to it
export const variablesSectionId = "variables_section";
