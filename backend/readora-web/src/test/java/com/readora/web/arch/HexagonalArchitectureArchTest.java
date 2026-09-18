package com.readora.web.arch;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

@AnalyzeClasses(packages = "com.readora", importOptions = {ImportOption.DoNotIncludeTests.class})
public class HexagonalArchitectureArchTest {

    @ArchTest
    public static final ArchRule domain_should_have_zero_spring_dependencies =
            noClasses().that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "org.springframework..",
                            "jakarta.persistence..",
                            "jakarta.servlet..",
                            "com.readora.application..",
                            "com.readora.infrastructure..",
                            "com.readora.web.."
                    );

    @ArchTest
    public static final ArchRule application_should_only_depend_on_domain =
            classes().that().resideInAPackage("..application..")
                    .should().onlyDependOnClassesThat().resideInAnyPackage(
                            "com.readora.domain..",
                            "com.readora.application..",
                            "java..",
                            "org.slf4j..",
                            "org.jspecify.annotations.."
                    );

    @ArchTest
    public static final ArchRule domain_should_not_use_serialization_or_validation_frameworks =
            noClasses().that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "tools.jackson..",
                            "com.fasterxml..",
                            "jakarta.validation.."
                    );

    @ArchTest
    public static final ArchRule web_should_only_reach_the_core_through_use_cases =
            noClasses().that().resideInAPackage("com.readora.web..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "com.readora.application.port.out..",
                            "com.readora.application.service..",
                            "com.readora.infrastructure.."
                    )
                    .because("controllers call port.in use cases; wiring lives in infrastructure (see AGENTS.md)");

    @ArchTest
    public static final ArchRule inbound_ports_are_use_cases =
            classes().that().resideInAPackage("..application.port.in..").and().areTopLevelClasses()
                    .and().doNotHaveSimpleName("package-info")
                    .should().beInterfaces()
                    .andShould().haveSimpleNameEndingWith("UseCase");

    @ArchTest
    public static final ArchRule outbound_ports_are_ports =
            classes().that().resideInAPackage("..application.port.out..").and().areTopLevelClasses()
                    .and().doNotHaveSimpleName("package-info")
                    .should().beInterfaces()
                    .andShould().haveSimpleNameEndingWith("Port");

    @ArchTest
    public static final ArchRule jpa_entities_live_in_infrastructure =
            classes().that().areAnnotatedWith("jakarta.persistence.Entity")
                    .should().resideInAPackage("com.readora.infrastructure.persistence.entity..")
                    .andShould().haveSimpleNameEndingWith("JpaEntity");

    @ArchTest
    public static final ArchRule adapters_implement_ports =
            classes().that().resideInAPackage("com.readora.infrastructure..").and().haveSimpleNameEndingWith("Adapter")
                    .should().implement(com.tngtech.archunit.base.DescribedPredicate.describe("an application out-port",
                            (com.tngtech.archunit.core.domain.JavaClass c) -> c.getPackageName().startsWith("com.readora.application.port.out")));

    @ArchTest
    public static final ArchRule modules_are_free_of_cycles =
            com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices()
                    .matching("com.readora.(domain|application|infrastructure|web)..")
                    .should().beFreeOfCycles();

    @ArchTest
    public static final ArchRule infrastructure_should_not_depend_on_web =
            noClasses().that().resideInAPackage("..infrastructure..")
                    .should().dependOnClassesThat().resideInAPackage("..web..");
}
