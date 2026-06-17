package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/unbindapp/unbind-api/config"
	"github.com/unbindapp/unbind-api/internal/common/log"
	_ "go.uber.org/automaxprocs"
)

const (
	usageText = `
Unbind CLI - Management Tool

Usage:
  unbind-cli [command] [options]

Commands:
  user:
    list                         List all users
    create --email=EMAIL --password=PASSWORD
                                 Create a new user
		change-password --email=EMAIL --password=PASSWORD

  group:
    list                         List all groups
    create --name=NAME --description=DESC [--team-id=ID]
                                 Create a new group
    add-user --email=EMAIL --group-name=NAME
                                 Add a user to a group
    list-permissions --group-name=NAME
                                 List permissions for a group
    grant-permission --group-name=NAME --action=ACTION --resource-type=TYPE --resource-id=ID [--scope=SCOPE]
                                 Grant permissions to a group

  team:
    create --name=NAME --displayname=DISPLAY
                                 Create a new team

  sync:
    group-to-k8s                 Sync group permissions with Kubernetes
    k8s-secrets                  Sync Kubernetes secrets with database

For detailed help on a specific command, use: unbind-cli help [command]
`
)

type Command struct {
	Name        string
	Description string
	FlagSet     *flag.FlagSet
	Handler     func()
}

func main() {
	// Load environment variables from .env file
	if err := godotenv.Overload(); err != nil {
		log.Warn("Error loading .env file:", err)
	}

	cfg := config.NewConfig()
	cli := NewCLI(cfg)

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	// Create FlagSets separately so they can be accessed in the handlers
	userListFlagSet := flag.NewFlagSet("user:list", flag.ExitOnError)
	userCreateFlagSet := flag.NewFlagSet("user:create", flag.ExitOnError)
	userChangePasswordFlagSet := flag.NewFlagSet("user:change-password", flag.ExitOnError)
	groupListFlagSet := flag.NewFlagSet("group:list", flag.ExitOnError)
	groupCreateFlagSet := flag.NewFlagSet("group:create", flag.ExitOnError)
	groupAddUserFlagSet := flag.NewFlagSet("group:add-user", flag.ExitOnError)
	groupListPermissionsFlagSet := flag.NewFlagSet("group:list-permissions", flag.ExitOnError)
	groupGrantPermissionFlagSet := flag.NewFlagSet("group:grant-permission", flag.ExitOnError)
	teamCreateFlagSet := flag.NewFlagSet("team:create", flag.ExitOnError)
	syncGroupToK8sFlagSet := flag.NewFlagSet("sync:group-to-k8s", flag.ExitOnError)
	syncK8sSecretsFlagSet := flag.NewFlagSet("sync:k8s-secrets", flag.ExitOnError)
	versionFlagSet := flag.NewFlagSet("version", flag.ExitOnError)
	helpFlagSet := flag.NewFlagSet("help", flag.ExitOnError)

	// Define flag variables
	email := userCreateFlagSet.String("email", "", "Email for the new user")
	password := userCreateFlagSet.String("password", "", "Password for the new user")

	groupName := groupCreateFlagSet.String("name", "", "Name of the group")
	groupDescription := groupCreateFlagSet.String("description", "", "Description of the group")

	addUserEmail := groupAddUserFlagSet.String("email", "", "Email of the user to add to the group")
	addUserGroupName := groupAddUserFlagSet.String("group-name", "", "Name of the group to add the user to")

	listPermGroupName := groupListPermissionsFlagSet.String("group-name", "", "Name of the group to list permissions for")

	grantGroupName := groupGrantPermissionFlagSet.String("group-name", "", "Name of the group to grant permissions to")
	grantAction := groupGrantPermissionFlagSet.String("action", "", "Action to grant permissions for")
	grantResourceType := groupGrantPermissionFlagSet.String("resource-type", "", "Resource type to grant permissions for")
	grantResourceID := groupGrantPermissionFlagSet.String("resource-id", "", "Resource ID to grant permissions for")

	teamName := teamCreateFlagSet.String("name", "", "Name of the team")
	teamDisplayName := teamCreateFlagSet.String("displayname", "", "Display name of the team")

	// User commands
	userListCmd := &Command{
		Name:        "user:list",
		Description: "List all users",
		FlagSet:     userListFlagSet,
		Handler:     cli.listUsers,
	}

	userCreateCmd := &Command{
		Name:        "user:create",
		Description: "Create a new user",
		FlagSet:     userCreateFlagSet,
		Handler: func() {
			_ = userCreateFlagSet.Parse(os.Args[2:])

			if *email == "" || *password == "" {
				fmt.Println("Error: email and password are required")
				userCreateFlagSet.Usage()
				os.Exit(1)
			}

			cli.createUser(*email, *password)
		},
	}

	userChangePasswordCmd := &Command{
		Name:        "user:change-password",
		Description: "Change password for a user",
		FlagSet:     userChangePasswordFlagSet,
		Handler: func() {
			_ = userChangePasswordFlagSet.Parse(os.Args[2:])
			if *email == "" || *password == "" {
				fmt.Println("Error: email and password are required")
				userChangePasswordFlagSet.Usage()
				os.Exit(1)
			}
			cli.changeUserPassword(*email, *password)
		},
	}

	// Group commands
	groupListCmd := &Command{
		Name:        "group:list",
		Description: "List all groups",
		FlagSet:     groupListFlagSet,
		Handler:     cli.listGroups,
	}

	groupCreateCmd := &Command{
		Name:        "group:create",
		Description: "Create a new group",
		FlagSet:     groupCreateFlagSet,
		Handler: func() {
			_ = groupCreateFlagSet.Parse(os.Args[2:])

			if *groupName == "" || *groupDescription == "" {
				fmt.Println("Error: name and description are required")
				groupCreateFlagSet.Usage()
				os.Exit(1)
			}

			cli.createGroup(*groupName, *groupDescription)
		},
	}

	groupAddUserCmd := &Command{
		Name:        "group:add-user",
		Description: "Add a user to a group",
		FlagSet:     groupAddUserFlagSet,
		Handler: func() {
			_ = groupAddUserFlagSet.Parse(os.Args[2:])

			if *addUserEmail == "" || *addUserGroupName == "" {
				fmt.Println("Error: email and group-name are required")
				groupAddUserFlagSet.Usage()
				os.Exit(1)
			}

			cli.addUserToGroup(*addUserEmail, *addUserGroupName)
		},
	}

	groupListPermissionsCmd := &Command{
		Name:        "group:list-permissions",
		Description: "List permissions for a group",
		FlagSet:     groupListPermissionsFlagSet,
		Handler: func() {
			_ = groupListPermissionsFlagSet.Parse(os.Args[2:])

			if *listPermGroupName == "" {
				fmt.Println("Error: group-name is required")
				groupListPermissionsFlagSet.Usage()
				os.Exit(1)
			}

			cli.listGroupPermissions(*listPermGroupName)
		},
	}

	groupGrantPermissionCmd := &Command{
		Name:        "group:grant-permission",
		Description: "Grant permissions to a group",
		FlagSet:     groupGrantPermissionFlagSet,
		Handler: func() {
			_ = groupGrantPermissionFlagSet.Parse(os.Args[2:])

			if *grantGroupName == "" || *grantAction == "" || *grantResourceType == "" || *grantResourceID == "" {
				fmt.Println("Error: group-name, action, resource-type, and resource-id are required")
				groupGrantPermissionFlagSet.Usage()
				os.Exit(1)
			}

			cli.grantPermission(*grantGroupName, *grantAction, *grantResourceType, *grantResourceID)
		},
	}

	// Team commands
	teamCreateCmd := &Command{
		Name:        "team:create",
		Description: "Create a new team",
		FlagSet:     teamCreateFlagSet,
		Handler: func() {
			_ = teamCreateFlagSet.Parse(os.Args[2:])

			if *teamName == "" || *teamDisplayName == "" {
				fmt.Println("Error: name and displayname are required")
				teamCreateFlagSet.Usage()
				os.Exit(1)
			}

			cli.createTeam(*teamName, *teamDisplayName)
		},
	}

	// Sync commands
	syncGroupToK8sCmd := &Command{
		Name:        "sync:group-to-k8s",
		Description: "Sync group permissions with Kubernetes",
		FlagSet:     syncGroupToK8sFlagSet,
		Handler:     cli.syncPermissionsWithK8S,
	}

	syncK8sSecretsCmd := &Command{
		Name:        "sync:k8s-secrets",
		Description: "Sync Kubernetes secrets with database",
		FlagSet:     syncK8sSecretsFlagSet,
		Handler:     cli.syncSecrets,
	}

	// Version command
	versionCmd := &Command{
		Name:        "version",
		Description: "Show the version of the CLI",
		FlagSet:     versionFlagSet,
		Handler:     cli.version,
	}

	allCommands := []*Command{
		userListCmd,
		userCreateCmd,
		userChangePasswordCmd,
		groupListCmd,
		groupCreateCmd,
		groupAddUserCmd,
		groupListPermissionsCmd,
		groupGrantPermissionCmd,
		teamCreateCmd,
		syncGroupToK8sCmd,
		syncK8sSecretsCmd,
		versionCmd,
	}

	// Help command
	helpCmd := &Command{
		Name:        "help",
		Description: "Show help for a command",
		FlagSet:     helpFlagSet,
		Handler: func() {
			if len(os.Args) < 3 {
				printUsage()
				return
			}

			helpForCmd := os.Args[2]
			for _, cmd := range allCommands {
				if cmd.Name == helpForCmd {
					fmt.Printf("Help for %s:\n  %s\n\nOptions:\n", cmd.Name, cmd.Description)
					cmd.FlagSet.PrintDefaults()
					return
				}
			}

			fmt.Printf("Unknown command: %s\n", helpForCmd)
			printUsage()
		},
	}

	allCommands = append(allCommands, helpCmd)

	cmdName := os.Args[1]

	// Execute the command
	for _, cmd := range allCommands {
		if cmd.Name == cmdName {
			cmd.Handler()
			return
		}
	}

	fmt.Printf("Unknown command: %s\n", os.Args[1])
	printUsage()
	os.Exit(1)
}

func printUsage() {
	fmt.Println(strings.TrimSpace(usageText))
}
