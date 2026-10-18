# Policy Reviewer

Policy Reviewer is a web-based prototype designed to support healthcare policy review workflows. The application allows users to organize policies and external guidelines, create policy review sessions, review identified findings, edit policy content, and track updated policy versions.

The project is built with React and Vite.

## Features

### Dashboard
- View active policy reviews
- View recently created policy reviews
- Track review status
- Navigate to the main areas of the application

### Policy Reviews
- Create a new policy review session
- Select one or more policies for review
- Select external guidelines manually or use automatic guideline selection
- View findings generated for the review
- Filter findings by recommendation type and priority
- Sort findings by priority, policy, or finding type
- Track findings as read or unread
- Open individual findings for review and editing
- Mark a policy review as completed

### Policy Editing
- Review the policy text associated with a finding
- Compare policy content with referenced guideline information
- Edit policy content
- Save edited policy versions
- Return to the review findings after saving changes

### Policies
- View available policies
- Search, filter, and sort policies
- Upload new policies
- Delete policies
- Open individual policy details
- View saved policy version history
- View the content of previously saved edited versions

### Guidelines
- View available external guidelines
- Search, filter, and sort guidelines
- Upload new guidelines
- Delete guidelines
- Select guidelines for use during a policy review

## Technology

This project uses:

- React
- Vite
- React Router
- JavaScript
- CSS
- Browser localStorage
- Git and GitHub
- GitHub Pages

## Running the Project Locally

Clone the repository and open the project directory.

Install the project dependencies:

```bash
npm install