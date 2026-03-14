import { RepoHeader } from '../shared/molecules/RepoHeader';
import { ZoneHeader } from '../shared/molecules/ZoneHeader';
import { AgentTile } from '../shared/molecules/AgentTile';
import { EmptyState } from '../shared/atoms/EmptyState';
import type { RepoWithZones } from '../../types';
import { LABEL_EMPTY_AGENTS } from '../../constants/messages';

interface RepoSectionProps {
  repo: RepoWithZones;
  onRepoRootClick: () => void;
  onAddAgentClick: () => void;
  onRemoveRepoClick: () => void;
  onToggleRepoClick: () => void;
  onToggleZoneClick: (repoId: string, branch: string) => void;
  onAgentClick: (agentId: string) => void;
  onRemoveAgentClick: (agentId: string) => void;
}

export const RepoSection = ({
  repo,
  onRepoRootClick,
  onAddAgentClick,
  onRemoveRepoClick,
  onToggleRepoClick,
  onToggleZoneClick,
  onAgentClick,
  onRemoveAgentClick,
}: RepoSectionProps) => {
  const hasAnyAgents = repo.zones.some((z) => z.agents.length > 0);

  return (
    <section className="repo-section">
      <RepoHeader
        name={repo.name}
        expanded={repo.isExpanded}
        onRootClick={onRepoRootClick}
        onAddAgentClick={onAddAgentClick}
        onRemoveClick={onRemoveRepoClick}
        onToggleClick={onToggleRepoClick}
      />

      {repo.isExpanded && (
        <div className="repo-zones">
          {!hasAnyAgents && repo.zones.length <= 1 ? (
            <EmptyState text={LABEL_EMPTY_AGENTS} />
          ) : (
            repo.zones.map((zone) => (
              <section key={zone.branch} className="zone-section">
                <ZoneHeader
                  branch={zone.branch}
                  isDevelop={zone.isDevelop}
                  expanded={zone.isExpanded}
                  onToggleClick={() => onToggleZoneClick(repo.repositoryId, zone.branch)}
                />

                {zone.isExpanded && zone.agents.length > 0 && (
                  <div className="zone-agents">
                    {zone.agents.map((agent) => (
                      <AgentTile
                        key={agent.agentId}
                        agentId={agent.agentId}
                        name={agent.name}
                        status={agent.status}
                        lastPrompt={agent.lastPrompt}
                        startedAt={agent.startedAt}
                        completedAt={agent.completedAt}
                        isSelected={agent.isFocused}
                        onClick={onAgentClick}
                        onRemoveClick={onRemoveAgentClick}
                      />
                    ))}
                  </div>
                )}

                {zone.isExpanded && zone.agents.length === 0 && (
                  <div className="zone-empty-line" />
                )}
              </section>
            ))
          )}
        </div>
      )}
    </section>
  );
};
